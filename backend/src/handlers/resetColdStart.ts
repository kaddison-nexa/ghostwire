import { pool } from "../lib/db.js";
import { json, type LambdaEvent, type LambdaResponse } from "../lib/http.js";

// Deliberately hardcoded to "new_analyst" — never parameterized by the
// caller. The public demo has to survive judges clicking around on the
// cold-start persona for the whole Judging Period without permanently
// warming it up for everyone after them, and this endpoint's whole safety
// story depends on it being structurally incapable of targeting any other
// account (signal_ghost's real seeded history included).
export const handler = async (_event: LambdaEvent): Promise<LambdaResponse> => {
  const { rows } = await pool.query(`SELECT id FROM users WHERE handle = 'new_analyst'`);
  if (rows.length === 0) return json(404, { error: "new_analyst user not found" });
  const userId = rows[0].id;

  await pool.query(`DELETE FROM edits WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM drafts WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM style_profiles WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM user_engagement WHERE user_id = $1`, [userId]);

  return json(200, { reset: true });
};
