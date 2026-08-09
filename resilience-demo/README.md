# Resilience demo (for the video)

Proves the memory layer survives a node failure — the "post while the story's
still hot" claim from the write-up needs to be more than an architecture
diagram slide. This is the concrete evidence for it.

## Why this runs locally, not against the real deployed cluster

The real Ghostwire backend talks to a CockroachDB Cloud **Basic** cluster,
which is fully managed — there's no console button or CLI command to kill a
specific node, by design (that's Cockroach Labs' infrastructure, not ours).
Cockroach Labs' own equivalent feature (an automated fault-tolerance demo
with live metrics) requires the paid **Advanced** tier.

Instead, this uses the free `cockroach demo` command to spin up a real
3-node cluster locally (in-memory, torn down when the script exits), which
gives real node-level control via `\demo shutdown <n>` / `\demo restart <n>`
— commands Cockroach Labs ships specifically for demos like this one. It
runs our actual `db/schema.sql`, not a simplified stand-in.

## Setup

1. Download `cockroach.exe` (~150MB, not checked into the repo):
   ```
   https://binaries.cockroachdb.com/cockroach-v25.4.14.windows-6.2-amd64.zip
   ```
   Extract it somewhere, e.g. `tools/`.

2. Run:
   ```bash
   COCKROACH_BIN=/path/to/cockroach.exe bash resilience-demo/run.sh
   ```
   (or put `cockroach` on your `PATH` and drop the env var).

## What it does, step by step

1. Applies `db/schema.sql` (the real schema, kept in sync automatically —
   `run.sh` concatenates it, nothing is duplicated in this folder)
2. Seeds one `style_profiles` row (`signal_ghost`, LinkedIn, `sample_count: 4`)
3. Reads it — **before** the outage
4. `\demo shutdown 2` — kills node 2 outright
5. Reads it again — **during** the outage, node 2 still down
6. **Writes** to it — an `UPDATE`, not just a read — still during the outage
7. `\demo restart 2` — brings node 2 back
8. Reads it one more time — proves the write that happened *during* the
   outage actually persisted, not just that the cluster came back online

## Recording it

Screen-record the terminal running `run.sh`. The moments worth landing on:
- The `BEFORE OUTAGE` read (`sample_count: 4`) — establish the baseline
- `node 2 has been shutdown` — the actual failure moment
- `DURING OUTAGE` read succeeding — the cluster didn't blink
- `DURING OUTAGE: write also succeeded` (`sample_count: 5`) — this is the
  strongest single line in the whole demo; it's a real write landing while
  a third of the cluster is down
- `AFTER RESTART` read still showing `5`, not `4` — the write wasn't lost,
  reconciled away, or rolled back when the node rejoined

Total runtime is under a minute — cluster startup dominates, the actual
kill/restart dance is near-instant.
