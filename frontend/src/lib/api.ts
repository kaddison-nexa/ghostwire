import type { DraftResult, FeedItem, HealthResult, Platform } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const API_KEY = import.meta.env.VITE_API_KEY;

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(API_KEY ? { "x-ghostwire-key": API_KEY } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function fetchFeed(handle: string): Promise<{ feed: FeedItem[] }> {
  return req(`/feed?handle=${encodeURIComponent(handle)}`);
}

export function generateDraft(params: {
  handle: string;
  newsItemId: string;
  platform: Platform;
}): Promise<{ draft: DraftResult }> {
  return req(`/draft`, { method: "POST", body: JSON.stringify(params) });
}

export function submitEdit(params: {
  draftId: string;
  handle: string;
  platform: Platform;
  editedText: string;
}): Promise<{ sampleCount: number }> {
  return req(`/edit`, { method: "POST", body: JSON.stringify(params) });
}

export function checkHealth(): Promise<HealthResult> {
  return req(`/health`);
}

export function ingestFeed(): Promise<{
  checked: number;
  inserted: number;
  insertedHeadlines: string[];
  errors: string[];
}> {
  return req(`/ingest`, { method: "POST" });
}
