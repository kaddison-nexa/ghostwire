import { pool } from "./db.js";

export async function getUserIdByHandle(handle: string): Promise<string | null> {
  const { rows } = await pool.query(`SELECT id FROM users WHERE handle = $1`, [handle]);
  return rows[0]?.id ?? null;
}
