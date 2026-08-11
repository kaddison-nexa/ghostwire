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
- `backend/scripts/seed.ts` — full DB bootstrap (schema + both personas).
  The curated `signal_ghost` history lives in `backend/src/lib/seedData.ts`,
  shared with `handlers/restoreSignalGhost.ts` so both a fresh bootstrap and
  a live re-seed use the exact same data, not two copies that can drift.
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
  agent skill (`.claude/skills/`) — that skill is worth rereading before
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
- `/news` (single-item manual ingest, `handlers/ingestNews.ts`) is mounted in
  `local-server.ts` only, deliberately NOT in `lambda-entry.ts` — it accepts
  unvalidated content from any caller and costs a real Bedrock call per
  request, with no product value on the public deployment (nothing in the
  app calls it; `/ingest` uses `upsertNewsItem` directly). Don't add it back
  to the public routes without re-thinking that tradeoff.
- The two demo personas need different protection, both scoped so the
  handler can only ever target one hardcoded account — never parameterized
  by the caller, so neither can be pointed at the other persona:
  `resetColdStart.ts` wipes `new_analyst` back to empty (the public URL has
  to survive judges clicking "generate draft" on it without permanently
  warming it up for the next visitor), and `restoreSignalGhost.ts` re-seeds
  `signal_ghost`'s curated voice from `lib/seedData.ts` (its style profile
  has no such protection from real edits diluting it over the Judging
  Period, so this is the recovery path). If you add a third demo persona,
  it needs the same treatment, not a shared/parameterized reset endpoint.

## Running it
```
cd backend && npm install && npm run seed && npm run dev
cd frontend && npm install && npm run dev
```

## Testing changes
There's no CI yet — run `npm run seed` against a scratch CockroachDB cluster
and exercise the four routes (`/feed`, `/draft`, `/edit`, `/health`) via the
frontend before calling something done.
