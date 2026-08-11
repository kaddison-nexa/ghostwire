# AGENTS.md

Guidance for AI coding agents picking up this repo.

## What this is
Ghostwire is an agentic memory demo built for the CockroachDB x AWS hackathon.
It personalizes cyber-news triage and drafts social posts that match a user's
actual writing voice, using CockroachDB as a single transactional store for
both vector embeddings and relational state (no separate vector DB).

## Layout
- `db/schema.sql` — CockroachDB schema. Source of truth for all tables.
- `backend/src/lib/` — framework-agnostic core logic (db, bedrock, memory, triage).
  Handlers are thin wrappers around this; keep business logic here, not in handlers.
- `backend/src/handlers/` — AWS Lambda handlers (`(event) => ...`). Each one
  also runs locally via `backend/src/local-server.ts`, which mounts the same
  handler functions behind Express for demo/dev — don't fork logic between
  the two, the handler is the single source of truth.
- `backend/scripts/seed.ts` — seeds a demo persona with prior post/edit
  history so the "cold start vs. warmed-up" demo works without weeks of real use.
- `frontend/` — Vite + React + TS. Talks to the backend over the routes in
  `local-server.ts` / the deployed API Gateway.

## Conventions
- Every write to `style_profiles` must happen in the same transaction as the
  `edits` insert that caused it (see `backend/src/lib/memory.ts`). This is the
  one invariant the whole memory story depends on — don't split it into two
  round trips.
- Any explicit multi-statement transaction (`BEGIN`...`COMMIT`) must be
  wrapped in `withSerializableRetry` (`backend/src/lib/db.ts`) so a `40001`
  serialization failure retries instead of failing the request outright —
  CockroachDB's SERIALIZABLE isolation makes these a normal, expected outcome
  under contention, not an error. See `memory.ts` and `budget.ts` for the
  pattern. Sourced from CockroachDB's own `designing-application-transactions`
  agent skill (`.agents/skills/`) — that skill is worth rereading before
  writing any new transactional code here.
- Embeddings are Amazon Titan Text Embeddings V2 (1024-dim), via
  `backend/src/lib/bedrock.ts`. If you swap embedding models, update the
  `VECTOR(1024)` dimension in `db/schema.sql` to match.
- Env vars (see `backend/.env.example`): `DATABASE_URL` (CockroachDB
  connection string), `AWS_REGION`, plus standard AWS credential env vars for
  Bedrock. `API_KEY` is only meaningful on the deployed Function URL (see
  `backend/src/lambda-entry.ts`) — `local-server.ts` ignores it.
- The public Function URL is unauthenticated by AWS's own access control, so
  `lambda-entry.ts` (not the handlers, not local-server.ts) is where request
  authorization and per-IP rate limiting (`backend/src/lib/rateLimit.ts`)
  live. Don't move rate-sensitive routes to a new path without adding them to
  `RATE_LIMITS` in `lambda-entry.ts`.

## Running it
```
cd backend && npm install && npm run seed && npm run dev
cd frontend && npm install && npm run dev
```

## Testing changes
There's no CI yet — run `npm run seed` against a scratch CockroachDB cluster
and exercise the four routes (`/feed`, `/draft`, `/edit`, `/health`) via the
frontend before calling something done.
