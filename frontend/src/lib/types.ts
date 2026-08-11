export type Platform = "linkedin" | "x";
export type Severity = "info" | "notable" | "critical";

export interface FeedItem {
  id: string;
  source: string;
  url: string;
  headline: string;
  summary: string;
  severity: Severity;
  published_at: string;
  relevance: number;
  // false during cold start (no engagement history) — relevance is then a
  // severity-derived sort key only, not a real personalized match score.
  personalized: boolean;
}

export interface DraftResult {
  id: string;
  handle: string;
  newsItemId: string;
  platform: Platform;
  generatedText: string;
  usedStyleSampleCount: number;
  createdAt: string;
}

export interface HealthResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface Persona {
  id: string;
  handle: string;
  label: string;
  warm: boolean;
}

export interface VectorPoint2D {
  x: number;
  y: number;
}

export interface StyleVectorMapResult {
  edits: Array<VectorPoint2D & { platform: Platform; createdAt: string }>;
  current: Partial<Record<Platform, VectorPoint2D>>;
}
