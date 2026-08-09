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

1. **Personalized triage** — scores incoming cyber news against *this user's*
   engagement history, not a global trending score.
2. **Voice-matched drafting** — generates platform-specific drafts (LinkedIn
   vs. X) by retrieving the user's persistent style vector and nearest past
   edits, via Amazon Bedrock (Titan embeddings + Claude).
3. **Memory consolidation** — every edit is written to CockroachDB in the same
   transaction that updates the running style-profile average, so a
   concurrent draft request can never read a profile mid-update.
4. **Resilience** — the UI's memory-layer status panel is a live read/write
   health check against the cluster, meant to be watched while a node/region
   is failed over during a demo.

## Why CockroachDB (not just "a database")

- One transactional store for both vector embeddings and relational state —
  no split-brain between a vector DB and a separate system of record.
- Serializable isolation on the read-modify-write that actually matters here:
  the edit → style-profile update.
- Multi-region durability matters concretely for this product: the whole
  value prop is posting while a story is still hot, so the memory layer
  going down during exactly the kind of infra stress that correlates with a
  breaking story is a real failure mode, not a hypothetical one.

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
- **signal_ghost** — has prior edit history on LinkedIn and X; drafts and
  feed ranking reflect a learned voice and topic interest from the start.
- **new_analyst** — no history; cold-start baseline for comparison.

Set `MOCK_LLM=false` with real AWS credentials and a real `DATABASE_URL`
(free tier at CockroachDB Cloud) to run against live Bedrock + CockroachDB.

## Repo layout

See [`AGENTS.md`](AGENTS.md) for a map of the codebase and the conventions an
agent (or a human) picking this up should follow.

## License

MIT — see [`LICENSE`](LICENSE).
