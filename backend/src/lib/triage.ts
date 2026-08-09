import { pool, toVectorLiteral, parseVectorLiteral } from "./db.js";
import type { FeedItem, Severity } from "./types.js";

const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 1, notable: 0.6, info: 0.3 };

/**
 * Personalized interest vector: the mean embedding of news items this user
 * has actually engaged with (drafted or flagged critical), computed in
 * application code rather than relying on DB-side vector aggregation so this
 * works regardless of aggregate-function support. Returns null for a cold
 * start (no history yet) — callers fall back to severity-only ranking.
 */
async function getUserInterestVector(userId: string): Promise<number[] | null> {
  const { rows } = await pool.query(
    `SELECT n.embedding
     FROM user_engagement e
     JOIN news_items n ON n.id = e.news_item_id
     WHERE e.user_id = $1 AND e.action IN ('drafted', 'flagged_critical')`,
    [userId]
  );
  if (rows.length === 0) return null;

  const vectors = rows.map((r) => parseVectorLiteral(r.embedding));
  const dim = vectors[0].length;
  const mean = new Array(dim).fill(0);
  for (const v of vectors) for (let i = 0; i < dim; i++) mean[i] += v[i] / vectors.length;
  return mean;
}

export async function getPersonalizedFeed(userId: string, limit = 10): Promise<FeedItem[]> {
  const interest = await getUserInterestVector(userId);

  if (!interest) {
    const { rows } = await pool.query(
      `SELECT id, source, url, headline, summary, severity, published_at
       FROM news_items ORDER BY published_at DESC LIMIT $1`,
      [limit]
    );
    // Not a personalized score — there's no engagement history to score
    // against yet. `relevance` here is only a sort key (severity, tie-broken
    // by recency), and `personalized: false` tells the UI not to present it
    // as a real match percentage.
    return rows.map((r) => ({ ...r, relevance: SEVERITY_WEIGHT[r.severity as Severity], personalized: false }));
  }

  const { rows } = await pool.query(
    `SELECT id, source, url, headline, summary, severity, published_at,
            embedding <-> $1::VECTOR AS distance
     FROM news_items
     ORDER BY published_at DESC
     LIMIT 50`,
    [toVectorLiteral(interest)]
  );

  return rows
    .map((r) => {
      // Cosine-ish distance is smaller-is-closer and unbounded; fold it into
      // a 0-1 relevance score blended with severity so a critical item never
      // gets buried purely for being topically novel.
      const similarity = 1 / (1 + Number(r.distance));
      const relevance = 0.7 * similarity + 0.3 * SEVERITY_WEIGHT[r.severity as Severity];
      return {
        id: r.id,
        source: r.source,
        url: r.url,
        headline: r.headline,
        summary: r.summary,
        severity: r.severity,
        published_at: r.published_at,
        relevance,
        personalized: true,
      };
    })
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);
}

export async function recordEngagement(userId: string, newsItemId: string, action: string) {
  await pool.query(
    `INSERT INTO user_engagement (user_id, news_item_id, action)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, news_item_id) DO UPDATE SET action = $3, created_at = now()`,
    [userId, newsItemId, action]
  );
}
