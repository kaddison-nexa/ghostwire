import { upsertNewsItem } from "../lib/news.js";
import { json, parseBody, type LambdaEvent, type LambdaResponse } from "../lib/http.js";
import type { Severity } from "../lib/types.js";

interface IngestNewsBody {
  source: string;
  url: string;
  headline: string;
  summary: string;
  severity?: Severity;
  publishedAt?: string;
}

export const handler = async (event: LambdaEvent): Promise<LambdaResponse> => {
  const body = parseBody<IngestNewsBody>(event);
  if (!body.source || !body.url || !body.headline || !body.summary) {
    return json(400, { error: "source, url, headline, and summary are required" });
  }

  const { id, inserted } = await upsertNewsItem({
    source: body.source,
    url: body.url,
    headline: body.headline,
    summary: body.summary,
    severity: body.severity ?? "info",
    publishedAt: body.publishedAt ?? new Date().toISOString(),
  });

  return json(inserted ? 201 : 200, { id, inserted });
};
