import { pool } from "../lib/db.js";
import { seedSignalGhostHistory } from "../lib/seedData.js";
import { json, type LambdaEvent, type LambdaResponse } from "../lib/http.js";

// Deliberately hardcoded to "signal_ghost" — never parameterized by the
// caller, same safety pattern as resetColdStart.ts. Unlike new_analyst,
// signal_ghost's style profile isn't protected from drift: anyone who
// generates and saves an edit for it feeds into its real running-average
// voice vector, with no distinction between curated demo content and a
// visitor poking at it. Over the month-long Judging Period that could
// genuinely dilute the curated voice — this re-seeds it back to known-good.
export const handler = async (_event: LambdaEvent): Promise<LambdaResponse> => {
  const { rows } = await pool.query(`SELECT id FROM users WHERE handle = 'signal_ghost'`);
  if (rows.length === 0) return json(404, { error: "signal_ghost user not found" });
  const userId = rows[0].id;

  await pool.query(`DELETE FROM edits WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM drafts WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM style_profiles WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM user_engagement WHERE user_id = $1`, [userId]);

  await seedSignalGhostHistory(userId);

  return json(200, { restored: true });
};
