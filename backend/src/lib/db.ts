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
