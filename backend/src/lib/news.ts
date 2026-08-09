import { randomUUID as uuid } from "node:crypto";
import { pool, toVectorLiteral } from "./db.js";
import { embedText } from "./bedrock.js";
import type { Severity } from "./types.js";

export interface NewsInput {
  source: string;
  url: string;
  headline: string;
  summary: string;
  severity: Severity;
  publishedAt: string;
}

/**
 * Dedupes on url before embedding — re-running an ingestion pass (or
 * re-polling the same feed on a schedule) is a no-op for anything already
 * seen, so this is safe to call repeatedly without inflating the embedding
 * bill or the feed with duplicates.
 */
export async function upsertNewsItem(item: NewsInput): Promise<{ id: string; inserted: boolean }> {
  const { rows: existing } = await pool.query(`SELECT id FROM news_items WHERE url = $1`, [item.url]);
  if (existing.length > 0) return { id: existing[0].id, inserted: false };

  const embedding = await embedText(`${item.headline}\n${item.summary}`);
  const { rows } = await pool.query(
    `INSERT INTO news_items (id, source, url, headline, summary, embedding, severity, published_at)
     VALUES ($1, $2, $3, $4, $5, $6::VECTOR, $7, $8)
     RETURNING id`,
    [uuid(), item.source, item.url, item.headline, item.summary, toVectorLiteral(embedding), item.severity, item.publishedAt]
  );
  return { id: rows[0].id, inserted: true };
}
