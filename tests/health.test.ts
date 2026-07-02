// Health endpoint (Phase 13): up ⇒ 200 {ok:true}; the response never carries
// tenant data or error details.
import { describe, expect, it } from 'vitest';
import { GET } from '../src/app/api/health/route';

describe('GET /api/health', () => {
  it('answers 200 {ok:true, db:up} when the database is reachable', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ ok: true, db: 'up' });
  });
});
