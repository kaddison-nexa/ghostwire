import "dotenv/config";
import { handler as feedHandler } from "./handlers/feed.js";
import { handler as generateDraftHandler } from "./handlers/generateDraft.js";
import { handler as submitEditHandler } from "./handlers/submitEdit.js";
import { handler as ingestFeedHandler } from "./handlers/ingestFeed.js";
import { handler as healthHandler } from "./handlers/health.js";
import { handler as resetColdStartHandler } from "./handlers/resetColdStart.js";
import { handler as restoreSignalGhostHandler } from "./handlers/restoreSignalGhost.js";
import { handler as styleVectorMapHandler } from "./handlers/styleVectorMap.js";
import { checkRateLimit } from "./lib/rateLimit.js";
import { BudgetExceededError } from "./lib/budget.js";
import type { LambdaEvent, LambdaResponse } from "./lib/http.js";

// The actual deployed entry point: a Lambda behind a public Function URL
// (payload format 2.0), routed internally by path/method exactly like
// local-server.ts routes Express — same handlers, same behavior, different
// transport. Don't let this drift from local-server.ts's route table; see
// AGENTS.md.
//
// Rate limiting and the shared-secret check live ONLY here, not in
// local-server.ts — local dev is trusted-network-only, the deployed
// Function URL is public and unauthenticated by AWS's own access control,
// so the app has to defend itself. See the "we need extra security" note in
// project history for why: the URL is public, /draft triggers a billable
// Bedrock call, so an unrestricted URL is a real cost-abuse surface, not a
// hypothetical one.
interface FunctionUrlEvent {
  rawPath: string;
  requestContext: { http: { method: string; sourceIp: string } };
  headers?: Record<string, string>;
  queryStringParameters?: Record<string, string> | null;
  body?: string | null;
  isBase64Encoded?: boolean;
}

const ROUTES: Record<string, Record<string, (e: LambdaEvent) => Promise<LambdaResponse>>> = {
  GET: { "/feed": feedHandler, "/health": healthHandler, "/style-vector-map": styleVectorMapHandler },
  POST: {
    "/draft": generateDraftHandler,
    "/edit": submitEditHandler,
    "/ingest": ingestFeedHandler,
    "/reset-cold-start": resetColdStartHandler,
    "/restore-signal-ghost": restoreSignalGhostHandler,
  },
};

// Per-IP, per-route request budget over a 5-minute window. /health is
// deliberately absent — the frontend's resilience panel polls it every
// 1.5s, and it's just a cheap SELECT, not something worth gating.
const RATE_LIMITS: Record<string, number> = {
  "/draft": 15,
  "/ingest": 5,
  "/edit": 20,
  "/feed": 60,
  "/style-vector-map": 60,
  "/reset-cold-start": 10,
  // Re-seeds ~7 stories x 2 platforms = ~21 Bedrock calls per invocation —
  // more expensive per-call than most routes, so a tighter budget than
  // reset-cold-start (which does zero Bedrock calls).
  "/restore-signal-ghost": 5,
};
const RATE_LIMIT_WINDOW_SECONDS = 300;

// CORS is handled entirely by the Function URL's own CORS config (set at
// `aws lambda create-function-url-config` time), NOT here — AWS intercepts
// OPTIONS preflight before it ever reaches this function when Function URL
// CORS is configured, and injects Access-Control-* headers on real
// responses itself. Adding our own copies of those headers on top produced
// a duplicate/combined Access-Control-Allow-Origin value that browsers
// reject outright — this bit us on the very first live CloudFront test.
function jsonResponse(statusCode: number, data: unknown): LambdaResponse {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  };
}

export const handler = async (event: FunctionUrlEvent): Promise<LambdaResponse> => {
  const method = event.requestContext.http.method;

  const route = ROUTES[method]?.[event.rawPath];
  if (!route) {
    return jsonResponse(404, { error: `no route for ${method} ${event.rawPath}` });
  }

  // Shared secret: not real auth (it ships in the public frontend bundle,
  // readable in devtools), but it filters out casual scanning/bots hitting
  // the raw Function URL without going through the app at all.
  const apiKey = process.env.API_KEY;
  if (apiKey && event.headers?.["x-ghostwire-key"] !== apiKey) {
    return jsonResponse(401, { error: "missing or invalid API key" });
  }

  const limit = RATE_LIMITS[event.rawPath];
  if (limit) {
    const sourceIp = event.requestContext.http.sourceIp;
    const { allowed, count } = await checkRateLimit(sourceIp, event.rawPath, limit, RATE_LIMIT_WINDOW_SECONDS);
    if (!allowed) {
      return jsonResponse(429, {
        error: `rate limit exceeded for ${event.rawPath}: ${count}/${limit} requests in the last ${RATE_LIMIT_WINDOW_SECONDS}s`,
      });
    }
  }

  const lambdaEvent: LambdaEvent = {
    body:
      event.isBase64Encoded && event.body
        ? Buffer.from(event.body, "base64").toString("utf-8")
        : event.body ?? null,
    queryStringParameters: event.queryStringParameters ?? null,
    pathParameters: null,
  };

  try {
    return await route(lambdaEvent);
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      return jsonResponse(503, { error: err.message });
    }
    throw err;
  }
};
