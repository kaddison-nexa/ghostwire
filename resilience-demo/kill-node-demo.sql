-- Resilience demo: proves the memory layer survives a node failure.
-- Run via resilience-demo/run.sh, which pipes db/schema.sql ahead of this
-- file so the schema is never duplicated/out of sync here.
--
-- Ephemeral only — this runs against a local `cockroach demo` cluster
-- (in-memory, torn down on exit), never against the real deployed
-- CockroachDB Cloud cluster. See resilience-demo/README.md.

INSERT INTO users (id, handle) VALUES ('11111111-1111-1111-1111-111111111111', 'signal_ghost')
ON CONFLICT (handle) DO NOTHING;

INSERT INTO style_profiles (user_id, platform, style_vector, sample_count)
SELECT '11111111-1111-1111-1111-111111111111', 'linkedin', ('[' || string_agg('0.01', ',') || ']')::VECTOR, 4
FROM generate_series(1, 1024)
ON CONFLICT (user_id, platform) DO NOTHING;

SELECT '=== CLUSTER: 3 live nodes, before outage ===' AS step;
\demo ls
SELECT pg_sleep(3) AS pause;

SELECT '=== BEFORE OUTAGE: reading style memory ===' AS step;
SELECT user_id, platform, sample_count FROM style_profiles WHERE platform = 'linkedin';
SELECT pg_sleep(3) AS pause;

\demo shutdown 2

SELECT '=== CLUSTER: node 2 is gone ===' AS step;
\demo ls
SELECT pg_sleep(3) AS pause;

SELECT '=== DURING OUTAGE (node 2 down): reading style memory ===' AS step;
SELECT user_id, platform, sample_count FROM style_profiles WHERE platform = 'linkedin';
SELECT pg_sleep(3) AS pause;

UPDATE style_profiles SET sample_count = sample_count + 1 WHERE platform = 'linkedin';

SELECT '=== DURING OUTAGE: write also succeeded ===' AS step;
SELECT user_id, platform, sample_count FROM style_profiles WHERE platform = 'linkedin';
SELECT pg_sleep(3) AS pause;

\demo restart 2

SELECT '=== AFTER RESTART: node 2 back, write survived ===' AS step;
SELECT user_id, platform, sample_count FROM style_profiles WHERE platform = 'linkedin';
SELECT pg_sleep(4) AS pause;

\q
