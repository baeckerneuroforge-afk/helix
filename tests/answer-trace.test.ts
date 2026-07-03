// =============================================================================
// ANSWER TRACE GATE — explainable answers ("Why this answer?").
//
//   1. The assistant turn persists a trace: the USED chunks (document id,
//      title, section, similarity score) + the relevance threshold.
//   2. Role-filtered hits appear in the trace ONLY as a COUNT. SECURITY test:
//      the COMPLETE payload of a chat turn with filtered hits (function
//      result + every persisted chat row) contains NO content/title/ids of
//      the filtered chunks — the count is the only thing that may exist.
//   3. The honest no-knowledge answer carries an honest trace: no sources,
//      noKnowledge=true (and the LLM was never called).
//   4. parseAnswerTrace round-trips the persisted jsonb and rejects junk.
// =============================================================================
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { withTenant } from '../src/lib/tenant';
import type { ChatCompletionRequest, ChatProvider } from '../src/lib/ai/types';
import {
  answerQuestion,
  ingestDocument,
  parseAnswerTrace,
  NO_KNOWLEDGE_ANSWER,
} from '../src/lib/rag';

const ORG = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const LEAD = 'tr_lead';
const MEMBER = 'tr_member';

const ALL_TABLES = [
  'organizations', 'memberships', 'audit_log',
  'documents', 'chunks', 'chat_messages',
];

const admin = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });

async function reset() {
  await admin.$executeRawUnsafe(
    `TRUNCATE ${ALL_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}

async function seed() {
  await withTenant(ORG, async (tx) => {
    await tx.organization.create({ data: { id: ORG, clerkOrgId: 'org_trace', name: 'Trace Org' } });
    await tx.membership.create({ data: { orgId: ORG, userId: LEAD, role: 'lead' } });
    await tx.membership.create({ data: { orgId: ORG, userId: MEMBER, role: 'member' } });
    await tx.visibilityGrant.create({ data: { orgId: ORG, level: 'confidential', role: 'lead' } });
  });
}

/** Chat provider spy: records every completion request, answers fixed. */
function chatSpy(reply = 'Answer from the spy.') {
  const requests: ChatCompletionRequest[] = [];
  const provider: ChatProvider = {
    name: 'spy',
    complete: async (req) => {
      requests.push(req);
      return reply;
    },
  };
  return { requests, provider };
}

beforeAll(async () => {
  const [role] = await prisma.$queryRaw<
    Array<{ current_user: string; rolsuper: boolean; rolbypassrls: boolean }>
  >`SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
  if (role?.current_user !== 'app_user' || role.rolsuper || role.rolbypassrls) {
    throw new Error(`Refusing to run: connected as "${role?.current_user}".`);
  }
  await reset();
});

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
  await admin.$disconnect();
});

beforeEach(async () => {
  await reset();
  await seed();
});

// --- 1. trace persistence ---------------------------------------------------

describe('trace persistence', () => {
  it('persists used sources WITH scores on the assistant message', async () => {
    await ingestDocument({
      orgId: ORG, actorId: 'seed', title: 'Vacation policy', source: 'manual',
      text: 'Every employee is entitled to thirty vacation days per calendar year.',
    });

    const result = await answerQuestion({
      orgId: ORG, actorId: LEAD, role: 'lead',
      question: 'How many vacation days per calendar year?',
    });

    // Returned trace mirrors the actually used chunks (same ids and scores).
    expect(result.trace.noKnowledge).toBe(false);
    expect(result.trace.filteredCount).toBe(0);
    expect(result.trace.threshold).toBeGreaterThan(0);
    expect(result.trace.sources.length).toBe(result.usedChunks.length);
    expect(result.trace.sources.length).toBeGreaterThan(0);
    for (const [i, src] of result.trace.sources.entries()) {
      const used = result.usedChunks[i]!;
      expect(src.documentId).toBe(used.documentId);
      expect(src.title).toBe('Vacation policy');
      expect(src.section).toBe(used.ord);
      expect(src.similarity).toBeCloseTo(used.similarity, 3);
      expect(src.similarity).toBeGreaterThanOrEqual(result.trace.threshold);
    }

    // The SAME trace is persisted on the assistant row (jsonb round-trip).
    const assistant = await withTenant(ORG, (tx) =>
      tx.chatMessage.findFirstOrThrow({ where: { role: 'assistant' } }),
    );
    const persisted = parseAnswerTrace(assistant.trace);
    expect(persisted).not.toBeNull();
    expect(persisted).toEqual(result.trace);

    // The user row carries no trace.
    const user = await withTenant(ORG, (tx) =>
      tx.chatMessage.findFirstOrThrow({ where: { role: 'user' } }),
    );
    expect(user.trace).toBeNull();
  });
});

// --- 2. disclosure: filtered hits are a COUNT, nothing more ------------------

describe('disclosure filter in the trace', () => {
  const SECRET_TITLE = 'Salary bands SECRETDOC';
  const SECRET_TEXT =
    'The salary band for senior engineers reaches ninety five thousand euro per calendar year.';

  async function askAsMember() {
    const { requests, provider } = chatSpy();
    const result = await answerQuestion({
      orgId: ORG, actorId: MEMBER, role: 'member', chat: provider,
      // Shares vocabulary with BOTH documents — the confidential one is a
      // nearby hit for the member, but hidden by the role filter.
      question: 'What is the salary band for senior engineers per calendar year?',
    });
    return { result, requests };
  }

  it('reports role-filtered hits as a count (>0) for the member, 0 for the lead', async () => {
    await ingestDocument({
      orgId: ORG, actorId: 'seed', title: SECRET_TITLE, source: 'manual',
      visibility: 'confidential', text: SECRET_TEXT,
    });
    await ingestDocument({
      orgId: ORG, actorId: 'seed', title: 'Vacation policy', source: 'manual',
      text: 'Every employee is entitled to thirty vacation days per calendar year.',
    });

    const { result } = await askAsMember();
    expect(result.trace.filteredCount).toBeGreaterThan(0);

    // The lead HAS the grant: nothing is filtered, the secret doc is a source.
    const leadResult = await answerQuestion({
      orgId: ORG, actorId: LEAD, role: 'lead',
      question: 'What is the salary band for senior engineers per calendar year?',
    });
    expect(leadResult.trace.filteredCount).toBe(0);
    expect(leadResult.trace.sources.some((s) => s.title === SECRET_TITLE)).toBe(true);
  });

  it('SECURITY: the complete payload contains NO content/title/ids of filtered chunks', async () => {
    await ingestDocument({
      orgId: ORG, actorId: 'seed', title: SECRET_TITLE, source: 'manual',
      visibility: 'confidential', text: SECRET_TEXT,
    });
    await ingestDocument({
      orgId: ORG, actorId: 'seed', title: 'Vacation policy', source: 'manual',
      text: 'Every employee is entitled to thirty vacation days per calendar year.',
    });

    // Collect the identifying details of the CONFIDENTIAL document as ground
    // truth (RLS is tenant-scoped, not role-scoped, so the tenant transaction
    // can read it — the disclosure filter lives in retrieval, which is exactly
    // what this test proves).
    const secretDoc = await withTenant(ORG, (tx) =>
      tx.document.findFirstOrThrow({
        where: { title: SECRET_TITLE },
        include: { chunks: true },
      }),
    );
    expect(secretDoc.chunks.length).toBeGreaterThan(0);
    const forbidden = [
      SECRET_TITLE,
      'SECRETDOC',
      secretDoc.id,
      ...secretDoc.chunks.map((c) => c.id),
      ...secretDoc.chunks.map((c) => c.content),
      'salary band for senior engineers reaches',
      'ninety five thousand',
    ];

    const { result } = await askAsMember();
    expect(result.trace.filteredCount).toBeGreaterThan(0); // the case is real

    // (a) The FULL function result — answer, sources, usedChunks, trace —
    //     i.e. everything a route/server action could ever serialize.
    const resultPayload = JSON.stringify(result);
    for (const needle of forbidden) {
      expect(resultPayload).not.toContain(needle);
    }

    // (b) Every persisted chat row of this turn (content + trace jsonb) —
    //     what the chat UI and history would replay later.
    const rows = await withTenant(ORG, (tx) => tx.chatMessage.findMany());
    const persistedPayload = JSON.stringify(rows);
    for (const needle of forbidden) {
      expect(persistedPayload).not.toContain(needle);
    }

    // The count itself IS allowed — and is the ONLY thing that is.
    const assistant = rows.find((r) => r.role === 'assistant')!;
    expect(parseAnswerTrace(assistant.trace)?.filteredCount).toBeGreaterThan(0);
  });
});

// --- 3. honest no-knowledge trace --------------------------------------------

describe('no-knowledge trace', () => {
  it('empty knowledge base ⇒ noKnowledge trace, no sources, LLM never called', async () => {
    const { requests, provider } = chatSpy();
    const result = await answerQuestion({
      orgId: ORG, actorId: LEAD, role: 'lead', chat: provider,
      question: 'What is the meaning of life?',
    });

    expect(result.answer).toBe(NO_KNOWLEDGE_ANSWER);
    expect(requests).toHaveLength(0); // below threshold ⇒ no AI call
    expect(result.trace.noKnowledge).toBe(true);
    expect(result.trace.sources).toEqual([]);
    expect(result.trace.filteredCount).toBe(0);

    const assistant = await withTenant(ORG, (tx) =>
      tx.chatMessage.findFirstOrThrow({ where: { role: 'assistant' } }),
    );
    expect(parseAnswerTrace(assistant.trace)).toEqual(result.trace);
  });
});

// --- 4. parseAnswerTrace defensiveness ---------------------------------------

describe('parseAnswerTrace', () => {
  it('rejects null, junk and wrong shapes; drops malformed sources', () => {
    expect(parseAnswerTrace(null)).toBeNull();
    expect(parseAnswerTrace(undefined)).toBeNull();
    expect(parseAnswerTrace('trace')).toBeNull();
    expect(parseAnswerTrace([])).toBeNull();
    expect(parseAnswerTrace({ v: 2, sources: [], filteredCount: 0, threshold: 0 })).toBeNull();
    expect(parseAnswerTrace({ v: 1, sources: 'x', filteredCount: 0, threshold: 0 })).toBeNull();

    const parsed = parseAnswerTrace({
      v: 1,
      sources: [
        { documentId: 'd', title: 't', section: 0, similarity: 0.5 },
        { documentId: 42, title: 't' }, // malformed → dropped
      ],
      filteredCount: 3,
      threshold: 0.45,
      noKnowledge: false,
    });
    expect(parsed).toEqual({
      v: 1,
      sources: [{ documentId: 'd', title: 't', section: 0, similarity: 0.5 }],
      filteredCount: 3,
      threshold: 0.45,
      noKnowledge: false,
    });
  });
});
