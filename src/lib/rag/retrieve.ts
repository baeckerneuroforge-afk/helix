// Semantic retrieval: question → query embedding → top-k tenant chunks.
//
// The similarity query runs inside withTenant(), so RLS already scopes it to
// the current tenant; the WHERE c.org_id = … predicate repeats that explicitly
// (defense-in-depth, and it lets the planner use the org_id index alongside the
// HNSW scan). `<=>` is pgvector's cosine distance; similarity = 1 - distance.
//
// Disclosure filter (Phase 4): the asker's ROLE decides which documents are
// even searchable — IN SQL, before any LLM ever sees a chunk. 'open' documents
// are always visible; 'restricted'/'confidential' require a visibility_grant
// for the role (visibility_grants is itself RLS'd, so only the tenant's own
// grants apply). No role / unknown role / no grant ⇒ only 'open' (fail-closed).
import type { Role } from '@prisma/client';
import { getEmbeddingProvider, type EmbeddingProvider } from '../ai';
import { withTenant } from '../tenant';
import { assertDimensions, toVectorLiteral } from './ingest';

const KNOWN_ROLES: ReadonlyArray<string> = ['owner', 'admin', 'lead', 'member'];

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  /** The document title — surfaced to the user as the SOURCE of the answer. */
  documentTitle: string;
  content: string;
  ord: number;
  /** Cosine similarity in [-1, 1]; higher = more relevant. */
  similarity: number;
}

export interface RetrieveInput {
  orgId: string;
  query: string;
  k?: number;
  embedder?: EmbeddingProvider;
  /**
   * Role of the asker (from the verified session / demo fixture). Omitted or
   * unknown ⇒ only 'open' documents are searched (fail-closed).
   */
  role?: Role;
}

export async function retrieve(input: RetrieveInput): Promise<RetrievedChunk[]> {
  const query = input.query.trim();
  if (!query) throw new Error('retrieve: query is required.');
  const k = input.k ?? 5;
  if (!Number.isInteger(k) || k <= 0 || k > 50) {
    throw new Error('retrieve: k must be an integer in [1, 50].');
  }

  const embedder = input.embedder ?? getEmbeddingProvider();
  const [queryVector] = await embedder.embed([query], 'query');
  assertDimensions([queryVector], embedder);
  const literal = toVectorLiteral(queryVector);

  // Compared as text against g."role"::text — an unknown value simply matches
  // no grant (fail-closed) instead of raising an enum-cast error.
  const roleText = input.role && KNOWN_ROLES.includes(input.role) ? input.role : '';

  const rows = await withTenant(input.orgId, (tx) =>
    tx.$queryRaw<
      Array<{
        chunk_id: string;
        document_id: string;
        document_title: string;
        content: string;
        ord: number;
        similarity: number;
      }>
    >`
      SELECT
        c."id"          AS chunk_id,
        c."document_id" AS document_id,
        d."title"       AS document_title,
        c."content",
        c."ord",
        1 - (c."embedding" <=> ${literal}::vector) AS similarity
      FROM "chunks" c
      JOIN "documents" d
        ON d."id" = c."document_id" AND d."org_id" = c."org_id"
      WHERE c."org_id" = ${input.orgId}::uuid
        AND (
          d."visibility" = 'open'
          OR EXISTS (
            SELECT 1 FROM "visibility_grants" g
            WHERE g."org_id" = c."org_id"
              AND g."level" = d."visibility"
              AND g."role"::text = ${roleText}
          )
        )
      ORDER BY c."embedding" <=> ${literal}::vector
      LIMIT ${k}
    `,
  );

  return rows.map((r) => ({
    chunkId: r.chunk_id,
    documentId: r.document_id,
    documentTitle: r.document_title,
    content: r.content,
    ord: r.ord,
    similarity: r.similarity,
  }));
}
