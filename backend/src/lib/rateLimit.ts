import { pool } from "./db.js";

/**
 * Fixed-window rate limit backed by CockroachDB — deliberately not in-memory,
 * since each Lambda invocation can land on a different execution
 * environment with no shared memory. One atomic upsert per request; no
 * read-modify-write race to worry about.
 *
 * Rows aren't cleaned up automatically — fine at hackathon-demo request
 * volume, would want a TTL/cleanup job before any real production use.
 */
export async function checkRateLimit(
  identity: string,
  route: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; count: number }> {
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `${identity}:${route}:${bucket}`;
  const expiresAt = new Date((bucket + 1) * windowSeconds * 1000).toISOString();

  const { rows } = await pool.query(
    `INSERT INTO rate_limits (limit_key, request_count, expires_at)
     VALUES ($1, 1, $2)
     ON CONFLICT (limit_key) DO UPDATE SET request_count = rate_limits.request_count + 1
     RETURNING request_count`,
    [key, expiresAt]
  );

  const count = rows[0].request_count as number;
  return { allowed: count <= limit, count };
}
