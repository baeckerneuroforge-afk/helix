// GET /api/health — uptime-check target (Phase 13).
//
// PUBLIC route (middleware exemption), deliberately free of secrets and
// tenant data: it answers "is the app up and can it reach the database as
// app_user" — nothing else. No migration details, no counts, no versions
// beyond the package version (public anyway).
//
// 200 { ok: true }  — app up, DB reachable.
// 503 { ok: false } — DB unreachable (the body never carries the error).
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/log';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, db: 'up' });
  } catch (err) {
    logError('health check failed', err);
    return Response.json({ ok: false, db: 'down' }, { status: 503 });
  }
}
