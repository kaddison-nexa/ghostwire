// Seeds two personas so the demo can show the cold-start vs. warmed-up
// contrast live, rather than requiring weeks of real usage:
//   - "signal_ghost": a persona with real edit history on both platforms —
//     see src/lib/seedData.ts (also used by handlers/restoreSignalGhost.ts
//     to re-seed this persona if drift accumulates from real usage).
//   - "new_analyst": a fresh user with zero history, for the side-by-side
//     cold-start comparison.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID as uuid } from "node:crypto";
import "dotenv/config";
import { pool } from "../src/lib/db.js";
import { upsertNewsItem } from "../src/lib/news.js";
import { SIGNAL_GHOST_HISTORY, BREAKING_SEED_ITEMS, seedSignalGhostHistory } from "../src/lib/seedData.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function applySchema() {
  const sql = readFileSync(join(__dirname, "..", "..", "db", "schema.sql"), "utf-8");
  await pool.query(sql);
  console.log("schema applied");
}

async function upsertUser(handle: string): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO users (id, handle) VALUES ($1, $2)
     ON CONFLICT (handle) DO UPDATE SET handle = $2
     RETURNING id`,
    [uuid(), handle]
  );
  return rows[0].id;
}

async function main() {
  await applySchema();

  const ghostId = await upsertUser("signal_ghost");
  const freshId = await upsertUser("new_analyst");
  console.log("seeded users:", { signal_ghost: ghostId, new_analyst: freshId });

  await seedSignalGhostHistory(ghostId);
  console.log(`seeded ${SIGNAL_GHOST_HISTORY.length} historical stories x 2 platforms for signal_ghost`);

  for (const b of BREAKING_SEED_ITEMS) await upsertNewsItem(b);
  console.log(`seeded ${BREAKING_SEED_ITEMS.length} breaking news items for live triage/draft demo`);

  await pool.end();
  console.log("done. Demo users: signal_ghost (warmed up), new_analyst (cold start).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
