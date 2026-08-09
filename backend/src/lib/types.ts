export type Platform = "linkedin" | "x" | "threads";
export type Severity = "info" | "notable" | "critical";
export type EngagementAction = "viewed" | "drafted" | "ignored" | "flagged_critical";

export interface NewsItem {
  id: string;
  source: string;
  url: string;
  headline: string;
  summary: string;
  severity: Severity;
  published_at: string;
}

export interface FeedItem extends NewsItem {
  relevance: number; // 0-1. Meaning depends on `personalized`.
  // false during cold start (no engagement history yet) — `relevance` is
  // then just the severity weight reused as a sort key, not a real
  // personalized score, and callers must not present it as one.
  personalized: boolean;
}

export interface Draft {
  id: string;
  user_id: string;
  news_item_id: string;
  platform: Platform;
  generated_text: string;
  used_style_sample_count: number;
  created_at: string;
}
