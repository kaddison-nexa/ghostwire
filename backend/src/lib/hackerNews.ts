import Parser from "rss-parser";
import type { NewsInput } from "./news.js";

// The Hacker News's public RSS feed — narrative security journalism, as
// opposed to CISA KEV's structured vulnerability records. Unlike KEV, an RSS
// item here carries no reliable signal of exploitation status, so we don't
// claim "critical" for these — that would overstate what the feed actually
// tells us. "notable" is the honest default; KEV stays the only source that
// earns "critical".
const FEED_URL = "https://feeds.feedburner.com/TheHackersNews";

const parser = new Parser();

export async function fetchLatestHackerNews(limit = 10): Promise<NewsInput[]> {
  const feed = await parser.parseURL(FEED_URL);

  return (feed.items ?? []).slice(0, limit).map((item) => ({
    source: "The Hacker News",
    url: item.link ?? item.guid ?? "",
    headline: item.title ?? "(untitled)",
    summary: (item.contentSnippet ?? item.content ?? "").slice(0, 500),
    severity: "notable" as const,
    publishedAt: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
  }));
}
