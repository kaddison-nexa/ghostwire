import pg from "pg";
import "dotenv/config";

const { Pool, types } = pg;

// CockroachDB's INT is 64-bit by default (unlike Postgres, where INT is
// 32-bit) — node-postgres returns 64-bit columns as strings to avoid silent
// precision loss on values beyond Number.MAX_SAFE_INTEGER. Our counts never
// get remotely close to that, so parse them back to numbers here rather than
// at every call site (a string sample_count previously broke `oldCount + 1`
// in memory.ts by string-concatenating instead of adding).
types.setTypeParser(20 /* int8 */, (val: string) => parseInt(val, 10));

// CockroachDB Cloud connection strings carry sslmode in the URL; node-postgres
// doesn't parse that itself, so we translate it into an explicit ssl config.
// `rejectUnauthorized: false` trades strict CA verification for demo speed —
// swap to a pinned CA bundle (sslmode=verify-full + sslrootcert) before any
// real deployment.
const useSsl = !(process.env.DATABASE_URL ?? "").includes("sslmode=disable");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: 10,
});

export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

export function parseVectorLiteral(text: string): number[] {
  return text
    .slice(1, -1)
    .split(",")
    .filter(Boolean)
    .map(Number);
}

/**
 * Retries the whole transaction attempt (fresh connection, fresh BEGIN) on a
 * SQLSTATE 40001 serialization failure — CockroachDB's SERIALIZABLE isolation
 * makes these a normal, expected outcome under contention, not an error
 * condition, per CockroachDB's own transaction-design guidance
 * (.agents/skills/designing-application-transactions). Any other error
 * (including our own BudgetExceededError, which has no `.code`) passes
 * through immediately — only real serialization failures get retried.
 */
export async function withSerializableRetry<T>(fn: () => Promise<T>, maxAttempts = 5): Promise<T> {
  let backoffMs = 100;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "40001" || attempt === maxAttempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, backoffMs + Math.random() * 100));
      backoffMs = Math.min(backoffMs * 2, 2000);
    }
  }
  throw new Error("unreachable");
}
