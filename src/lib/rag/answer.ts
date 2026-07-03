// RAG answering: question → retrieve → grounded LLM answer WITH sources.
//
// Honesty rule: if retrieval yields nothing above the embedder's relevance
// threshold, we do NOT call the LLM at all — we return the fixed "no verified
// knowledge" answer. The LLM is additionally instructed to use only the
// supplied context, so both layers guard against hallucinated answers.
//
// Persistence: the user question + assistant answer land in chat_messages and
// the audit entry in audit_log, all in ONE withTenant() transaction after the
// answer exists (an LLM call must never run inside an open DB transaction).
import type { Prisma, Role } from '@prisma/client';
import {
  getChatProvider,
  getEmbeddingProvider,
  type ChatProvider,
  type EmbeddingProvider,
} from '../ai';
import { logAudit } from '../audit';
import { assertWithinDailyLimit } from '../limits';
import { withTenant } from '../tenant';
import { retrieveWithTrace, type RetrievedChunk } from './retrieve';

export const NO_KNOWLEDGE_ANSWER =
  'I have no verified knowledge about this in the knowledge base.';

/** Wording persisted by earlier (German-default) releases — old chat rows
 * still carry it, so the UI's no-knowledge check accepts it too. */
export const LEGACY_NO_KNOWLEDGE_ANSWERS: readonly string[] = [
  'Dazu habe ich kein geprüftes Wissen in der Wissensbasis.',
];

/**
 * CANONICAL sources format. Every grounded answer ends with exactly one line
 *
 *     Sources: <title1>, <title2>, …
 *
 * appended deterministically by THIS layer (never left to the LLM — the system
 * prompt forbids the model to emit its own source list, and any line it emits
 * anyway is stripped). The honest no-knowledge answer carries NO sources line.
 * This marked line persists the sources inside the message text (the chat UI —
 * and later the skill engine — parse it back via this marker); since 0021 the
 * richer machine-readable trace additionally lives in chat_messages.trace.
 */
export const SOURCES_MARKER = 'Sources:';

/** All markers that may occur in PERSISTED messages: the canonical English one
 * plus the pre-English-default German one. Parse with these; write only the
 * canonical SOURCES_MARKER. */
export const SOURCES_MARKERS: readonly string[] = [SOURCES_MARKER, 'Quellen:'];

const SYSTEM_PROMPT = `You are the knowledge assistant of this organization's internal knowledge base.

Rules:
- Answer ONLY from the context passages provided in the user message. Each passage is prefixed with its source document title in [brackets].
- If the context does not contain the answer, reply exactly: "${NO_KNOWLEDGE_ANSWER}" — do not guess, do not use outside knowledge.
- Do NOT list or repeat your sources and do not add a "${SOURCES_MARKER}" line — the system appends the canonical sources line itself.
- Answer in the language of the question, concisely.`;

/** One prior turn of the SAME actor's conversation (see loadChatHistory). */
export interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnswerQuestionInput {
  orgId: string;
  actorId: string;
  question: string;
  k?: number;
  embedder?: EmbeddingProvider;
  chat?: ChatProvider;
  /**
   * Prior turns fed into the LLM prompt for follow-up questions (multi-turn).
   * DISCLOSURE INVARIANT: retrieval uses ONLY the current question + role —
   * history goes into the prompt, never into retrieval. Callers must load
   * history per ACTOR (loadChatHistory), so nobody receives another person's
   * answers through the prompt. Omitted ⇒ single-turn (previous behavior).
   */
  history?: ChatHistoryTurn[];
  /**
   * Role of the asker — passed through to retrieve()'s disclosure filter.
   * Knowledge invisible to the role is simply never retrieved, so the honest
   * "no verified knowledge" answer applies WITHOUT revealing that hidden
   * knowledge exists. Omitted ⇒ only 'open' documents (fail-closed).
   */
  role?: Role;
}

/**
 * One source the answer is grounded on — always a chunk the asker's role WAS
 * allowed to see (it went into the LLM context). Role-filtered hits never
 * appear here; they exist in the trace only as `filteredCount`.
 */
export interface AnswerTraceSource {
  documentId: string;
  title: string;
  /** Chunk position within the document (0-based ord). */
  section: number;
  /** Cosine similarity of chunk vs. question, rounded to 4 decimals. */
  similarity: number;
}

/**
 * The "Why this answer?" trace persisted on the assistant chat message
 * (chat_messages.trace, 0021) and returned to the caller.
 *
 * DISCLOSURE INVARIANT: hits hidden by the asker's role are represented
 * EXCLUSIVELY as `filteredCount` — no titles, content, ids or any other
 * identifying detail, neither here nor anywhere else in the payload.
 */
export interface AnswerTrace {
  v: 1;
  /** Chunks used as LLM context (role-visible by construction). */
  sources: AnswerTraceSource[];
  /** Number of nearby hits hidden by the asker's role — a bare count. */
  filteredCount: number;
  /** Relevance threshold in force — lets the UI band the scores meaningfully. */
  threshold: number;
  /** True ⇒ the honest no-knowledge answer (below threshold ⇒ the LLM was
   * never called; or the model itself judged the context insufficient). */
  noKnowledge: boolean;
}

export interface AnswerQuestionResult {
  /** Canonical answer text; grounded answers end with the `Quellen: …` line. */
  answer: string;
  /** Unique document titles the answer is based on; empty for the honest "no knowledge" case. */
  sources: string[];
  /** The chunks that were used as context (for display/debugging). */
  usedChunks: RetrievedChunk[];
  /** Explainability trace — also persisted on the assistant chat message. */
  trace: AnswerTrace;
}

function buildUserMessage(question: string, chunks: RetrievedChunk[]): string {
  const context = chunks
    .map((c) => `[${c.documentTitle}] ${c.content}`)
    .join('\n\n');
  return `Context passages:\n\n${context}\n\nQuestion: ${question}`;
}

/** Drop any sources line the model emitted despite the prompt — the canonical
 * line is appended below, exactly once. */
function stripModelSourceLines(text: string): string {
  return text
    .split('\n')
    .filter((line) => !SOURCES_MARKERS.some((m) => line.trim().startsWith(m)))
    .join('\n')
    .trim();
}

export async function answerQuestion(input: AnswerQuestionInput): Promise<AnswerQuestionResult> {
  const question = input.question.trim();
  if (!question) throw new Error('answerQuestion: question is required.');

  // Kostenschutz VOR dem ersten bezahlten Aufruf (Embedding/LLM).
  await withTenant(input.orgId, (tx) => assertWithinDailyLimit(tx, 'chat'));

  const embedder = input.embedder ?? getEmbeddingProvider();
  const { chunks: retrieved, filteredCount } = await retrieveWithTrace({
    orgId: input.orgId,
    query: question,
    k: input.k,
    embedder,
    role: input.role,
    // Count only filtered hits that would actually have been used as context.
    minSimilarity: embedder.relevanceThreshold,
  });
  const relevant = retrieved.filter((c) => c.similarity >= embedder.relevanceThreshold);

  let answer: string;
  let sources: string[] = [];
  if (relevant.length === 0) {
    answer = NO_KNOWLEDGE_ANSWER;
  } else {
    const chat = input.chat ?? getChatProvider();
    const raw = await chat.complete({
      system: SYSTEM_PROMPT,
      messages: [
        ...(input.history ?? []),
        { role: 'user', content: buildUserMessage(question, relevant) },
      ],
    });
    const cleaned = stripModelSourceLines(raw);
    if (cleaned.includes(NO_KNOWLEDGE_ANSWER)) {
      // The model itself concluded the context is insufficient: no sources line.
      answer = NO_KNOWLEDGE_ANSWER;
    } else {
      sources = [...new Set(relevant.map((c) => c.documentTitle))];
      answer = `${cleaned}\n\n${SOURCES_MARKER} ${sources.join(', ')}`;
    }
  }

  // Explainability trace: what the answer used, how relevant it was, and how
  // many nearby hits the role disclosure filter hid (COUNT ONLY — the filtered
  // rows never reached the application, see retrieveWithTrace).
  const trace: AnswerTrace = {
    v: 1,
    sources: relevant.map((c) => ({
      documentId: c.documentId,
      title: c.documentTitle,
      section: c.ord,
      similarity: Math.round(c.similarity * 10000) / 10000,
    })),
    filteredCount,
    threshold: embedder.relevanceThreshold,
    noKnowledge: answer === NO_KNOWLEDGE_ANSWER,
  };

  await withTenant(input.orgId, async (tx) => {
    await tx.chatMessage.create({
      data: { orgId: input.orgId, role: 'user', content: question, actorId: input.actorId },
    });
    await tx.chatMessage.create({
      data: {
        orgId: input.orgId,
        role: 'assistant',
        content: answer,
        actorId: input.actorId,
        trace: trace as unknown as Prisma.InputJsonValue,
      },
    });
    await logAudit(tx, {
      orgId: input.orgId,
      actorId: input.actorId,
      actorType: 'agent',
      action: 'chat.answered',
      target: question.slice(0, 120),
    });
  });

  return { answer, sources, usedChunks: relevant, trace };
}

/**
 * Parse a persisted chat_messages.trace value back into an AnswerTrace.
 * Defensive: user rows, pre-0021 rows (NULL) and unknown shapes yield null —
 * the UI then simply shows no trace. Malformed source entries are dropped.
 */
export function parseAnswerTrace(value: unknown): AnswerTrace | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const t = value as Record<string, unknown>;
  if (t.v !== 1 || !Array.isArray(t.sources)) return null;
  if (typeof t.filteredCount !== 'number' || typeof t.threshold !== 'number') return null;
  const sources: AnswerTraceSource[] = [];
  for (const s of t.sources) {
    if (typeof s !== 'object' || s === null) continue;
    const src = s as Record<string, unknown>;
    if (
      typeof src.documentId === 'string' &&
      typeof src.title === 'string' &&
      typeof src.section === 'number' &&
      typeof src.similarity === 'number'
    ) {
      sources.push({
        documentId: src.documentId,
        title: src.title,
        section: src.section,
        similarity: src.similarity,
      });
    }
  }
  return {
    v: 1,
    sources,
    filteredCount: t.filteredCount,
    threshold: t.threshold,
    noKnowledge: t.noKnowledge === true,
  };
}

/**
 * Load the last `limit` turns of THIS actor's conversation, oldest first —
 * the only sanctioned source for AnswerQuestionInput.history. Scoped per
 * actor: rows of other users (and pre-0010 rows with actor_id NULL) never
 * load, so prompt history cannot leak another person's disclosed knowledge.
 */
export async function loadChatHistory(
  orgId: string,
  actorId: string,
  limit = 10,
): Promise<ChatHistoryTurn[]> {
  if (!actorId) return [];
  const rows = await withTenant(orgId, (tx) =>
    tx.chatMessage.findMany({
      where: { actorId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
  );
  return rows
    .reverse()
    .map((m) => ({ role: m.role === 'user' ? ('user' as const) : ('assistant' as const), content: m.content }));
}
