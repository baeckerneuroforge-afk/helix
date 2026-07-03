#!/bin/sh
# Vercel build entry (`vercel-build` takes precedence over `build`).
#
# Production deploys apply pending Prisma migrations BEFORE the build, using
# the OWNER connection (DIRECT_DATABASE_URL) — never the runtime app_user URL,
# which lacks DDL rights by design (least privilege, see prisma/schema.prisma).
# Preview deploys never touch the database.
set -eu

# The Neon↔Vercel integration provides the unpooled (direct) connection as
# DATABASE_URL_UNPOOLED — map it onto the name the Prisma schema expects.
if [ -z "${DIRECT_DATABASE_URL:-}" ] && [ -n "${DATABASE_URL_UNPOOLED:-}" ]; then
  export DIRECT_DATABASE_URL="$DATABASE_URL_UNPOOLED"
fi

if [ "${VERCEL_ENV:-}" = "production" ]; then
  if [ -n "${DIRECT_DATABASE_URL:-}" ]; then
    echo "vercel-build: production deploy — applying Prisma migrations…"
    npx prisma migrate deploy
  else
    echo "vercel-build: WARNING — DIRECT_DATABASE_URL is not set; skipping 'prisma migrate deploy'." >&2
    echo "vercel-build: add it (owner role, unpooled connection) in Vercel → Settings → Environment Variables so migrations apply on deploy." >&2
  fi
fi

next build
