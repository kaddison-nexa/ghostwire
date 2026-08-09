import { fetchLatestKev } from "../lib/cisaKev.js";
import { fetchLatestHackerNews } from "../lib/hackerNews.js";
import { upsertNewsItem, type NewsInput } from "../lib/news.js";
import { json, type LambdaEvent, type LambdaResponse } from "../lib/http.js";

// Meant to run on an EventBridge schedule once deployed; exposed as a route
// here so it can also be triggered manually for the demo. Each source is
// fetched independently so one feed failing (network blip, feed format
// change) doesn't take the other down with it. Idempotent via
// upsertNewsItem's url dedupe, so polling this repeatedly is safe.
export const handler = async (_event: LambdaEvent): Promise<LambdaResponse> => {
  const sources: Array<{ name: string; fetch: () => Promise<NewsInput[]> }> = [
    { name: "CISA KEV", fetch: () => fetchLatestKev(10) },
    { name: "The Hacker News", fetch: () => fetchLatestHackerNews(10) },
  ];

  let checked = 0;
  let insertedCount = 0;
  const insertedHeadlines: string[] = [];
  const errors: string[] = [];

  for (const source of sources) {
    try {
      const entries = await source.fetch();
      checked += entries.length;
      for (const entry of entries) {
        if (!entry.url) continue; // skip malformed feed items with no link to dedupe on
        const { inserted } = await upsertNewsItem(entry);
        if (inserted) {
          insertedCount++;
          insertedHeadlines.push(entry.headline);
        }
      }
    } catch (err) {
      errors.push(`${source.name}: ${(err as Error).message}`);
    }
  }

  return json(200, { checked, inserted: insertedCount, insertedHeadlines, errors });
};
