-- Ghostwire memory schema (CockroachDB, pgvector-compatible VECTOR type)
-- Embedding dimension matches Amazon Titan Text Embeddings V2 (1024).

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handle STRING UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Personalized triage memory: every news item the pipeline has seen.
CREATE TABLE IF NOT EXISTS news_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source STRING NOT NULL,
    url STRING NOT NULL,
    headline STRING NOT NULL,
    summary STRING NOT NULL,
    embedding VECTOR(1024) NOT NULL,
    severity STRING NOT NULL DEFAULT 'info', -- info | notable | critical
    published_at TIMESTAMPTZ NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- What has this user actually acted on? Drives personalized relevance scoring.
CREATE TABLE IF NOT EXISTS user_engagement (
    user_id UUID NOT NULL REFERENCES users(id),
    news_item_id UUID NOT NULL REFERENCES news_items(id),
    action STRING NOT NULL, -- viewed | drafted | ignored | flagged_critical
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, news_item_id)
);

-- The persistent, per-platform voice profile. Read on every draft generation,
-- written transactionally alongside every edit.
CREATE TABLE IF NOT EXISTS style_profiles (
    user_id UUID NOT NULL REFERENCES users(id),
    platform STRING NOT NULL, -- 'linkedin' | 'x' | 'threads'
    style_vector VECTOR(1024) NOT NULL,
    sample_count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, platform)
);

CREATE TABLE IF NOT EXISTS drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    news_item_id UUID NOT NULL REFERENCES news_items(id),
    platform STRING NOT NULL,
    generated_text STRING NOT NULL,
    used_style_sample_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every edit is a memory write, not just a UI action.
CREATE TABLE IF NOT EXISTS edits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID NOT NULL REFERENCES drafts(id),
    user_id UUID NOT NULL REFERENCES users(id),
    platform STRING NOT NULL,
    edited_text STRING NOT NULL,
    edit_vector VECTOR(1024) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE VECTOR INDEX IF NOT EXISTS news_items_embedding_idx ON news_items (embedding);
CREATE VECTOR INDEX IF NOT EXISTS edits_edit_vector_idx ON edits (edit_vector);

-- Fixed-window rate limiting for the public Lambda Function URL. Key is
-- "<sourceIp>:<route>:<windowBucket>" so each window is a fresh row rather
-- than a read-modify-write race — the upsert's increment is atomic.
CREATE TABLE IF NOT EXISTS rate_limits (
    limit_key STRING PRIMARY KEY,
    request_count INT NOT NULL DEFAULT 1,
    expires_at TIMESTAMPTZ NOT NULL
);

-- Hard daily spend cap on Bedrock usage, tracked in micro-USD (millionths of
-- a dollar) for integer precision on sub-cent per-call costs. One row per
-- UTC calendar day; a new day just starts a fresh row at 0, no cleanup job
-- needed. See backend/src/lib/budget.ts for the enforcement.
CREATE TABLE IF NOT EXISTS daily_budget (
    date_key STRING PRIMARY KEY,
    spent_micro_usd INT NOT NULL DEFAULT 0
);
