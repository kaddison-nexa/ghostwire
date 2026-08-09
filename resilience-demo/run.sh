#!/usr/bin/env bash
# Runs the resilience demo against a local, ephemeral 3-node CockroachDB
# cluster — NOT the real deployed CockroachDB Cloud cluster (that's a Basic
# tier, fully managed, with no node-level control). See README.md for why
# this is the right tool for the video's kill-a-node beat specifically.
#
# Requires cockroach.exe on PATH or at COCKROACH_BIN. Download:
#   https://binaries.cockroachdb.com/cockroach-v25.4.14.windows-6.2-amd64.zip
set -euo pipefail
cd "$(dirname "$0")"

COCKROACH_BIN="${COCKROACH_BIN:-cockroach}"

cat ../db/schema.sql kill-node-demo.sql | "$COCKROACH_BIN" demo --nodes=3 --insecure --no-example-database
