# Ghostwire

Persistent, transactionally-consistent voice memory for a cybersecurity
personal-brand agent — built for the **CockroachDB × AWS Hackathon**.

Most "AI writes your posts" tools fake personalization with a fixed window of
your last few edits stuffed into a prompt. Ghostwire replaces that with a real
memory: every accepted edit updates a persistent, per-platform style profile
in one atomic transaction, and every draft retrieves that profile plus the
nearest historical exemplars — so voice-matching compounds over time instead
of resetting every conversation. See [`db/schema.sql`](db/schema.sql) and
[`backend/src/lib/memory.ts`](backend/src/lib/memory.ts) for the core of it.

## What it does

1. **Live personalized triage** — pulls real, current entries from CISA's
   Known Exploited Vulnerabilities catalog and The Hacker News
   ([`backend/src/lib/cisaKev.ts`](backend/src/lib/cisaKev.ts),
   [`hackerNews.ts`](backend/src/lib/hackerNews.ts)), then scores them against
   *this user's* engagement history — not a global trending score. A
   cold-start user with no history yet gets an honest fallback (sorted by
   severity/recency) instead of a fabricated match score; the UI visibly
   distinguishes the two states.
2. **Voice-matched drafting** — generates platform-specific drafts (LinkedIn
   vs. X) by retrieving the user's persistent style vector and nearest past
   edits, via Amazon Bedrock (Titan embeddings + Claude Sonnet 4.5).
3. **Memory consolidation** — every edit is written to CockroachDB in the same
   transaction that updates the running style-profile average, so a
   concurrent draft request can never read a profile mid-update.
4. **Resilience, proven not just claimed** — see
   [`resilience-demo/`](resilience-demo) for a scripted, reproducible run
   against a real 3-node cluster that kills a node mid-write and shows both
   the read *and* the write surviving, with the write still intact after the
   node rejoins.

## Why CockroachDB

- One transactional store for both vector embeddings and relational state —
  no split-brain between a vector DB and a separate system of record.
- Serializable isolation on the read-modify-write that actually matters here:
  the edit → style-profile update.
- Durability matters concretely for this product: the whole value prop is
  posting while a story is still hot.

## CockroachDB tools used

- **Distributed Vector Indexing** — the core of the memory system; see above.
- **Agent Skills Repo** ([cockroachlabs/cockroachdb-skills](https://github.com/cockroachlabs/cockroachdb-skills)) — installed via `npx skills add cockroachlabs/cockroachdb-skills` (`.claude/skills/`, tracked via `skills-lock.json`). Using `designing-application-transactions` to review our own transaction code surfaced a real gap: neither `recordEditAndUpdateStyle` nor `chargeBudget` retried on `40001` serialization failures, which CockroachDB's SERIALIZABLE isolation makes a normal, expected outcome under contention. Fixed in `backend/src/lib/db.ts` (`withSerializableRetry`) — a concrete improvement the skill produced, not just a checkbox.

## Live deployment

- **Frontend**: React SPA on S3 behind CloudFront.
- **Backend**: AWS Lambda behind a public Function URL
  ([`backend/src/lambda-entry.ts`](backend/src/lambda-entry.ts)), talking to
  CockroachDB Cloud and Amazon Bedrock.

## Stack

- **Backend**: TypeScript, AWS Lambda-shaped handlers (also runnable locally
  via Express — see `backend/src/local-server.ts`), CockroachDB (`pg` driver,
  pgvector-compatible `VECTOR` columns), Amazon Bedrock.
- **Frontend**: Vite + React + TypeScript + Tailwind v4.

## Running locally

```bash
# 1. Backend
cd backend
cp .env.example .env       # fill in DATABASE_URL (CockroachDB) + AWS creds,
                            # or leave MOCK_LLM=true to run without either
npm install
npm run seed                # applies db/schema.sql and seeds two demo personas
npm run dev                  # http://localhost:4000

# 2. Frontend
cd frontend
cp .env.example .env
npm install
npm run dev                  # http://localhost:5173
```

Two demo personas are seeded so the memory story is visible immediately
rather than requiring weeks of real usage:
- **signal_ghost** — has prior edit history on LinkedIn and X (tuned toward
  AI-attack and supply-chain interest); drafts and feed ranking reflect a
  learned voice and topic interest from the start.
- **new_analyst** — no history; cold-start baseline for comparison.

Set `MOCK_LLM=false` with real AWS credentials and a real `DATABASE_URL`
(CockroachDB Cloud) to run against live Bedrock + CockroachDB.

## Deploying

`backend/scripts/build-lambda.mjs` bundles `lambda-entry.ts` into a single
deployable zip; `backend/deploy/` has the IAM trust/permission policies and
CloudFront config used for the live deployment above. See
[`AGENTS.md`](AGENTS.md) for the full picture of how the pieces fit together.

## Resilience demo

[`resilience-demo/`](resilience-demo) runs a real 3-node CockroachDB cluster
locally, applies the actual `db/schema.sql`, kills a node, reads *and writes*
`style_profiles` while it's down, then restarts the node and confirms the
write survived. Proof, not just a claim — see
[`resilience-demo/README.md`](resilience-demo/README.md).

## Repo layout

See [`AGENTS.md`](AGENTS.md) for a map of the codebase and the conventions an
agent (or a human) picking this up should follow.

## License

MIT — see [`LICENSE`](LICENSE).
