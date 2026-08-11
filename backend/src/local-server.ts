import express, { type Request, type Response } from "express";
import cors from "cors";
import "dotenv/config";
import type { LambdaEvent, LambdaResponse } from "./lib/http.js";

import { handler as feedHandler } from "./handlers/feed.js";
import { handler as generateDraftHandler } from "./handlers/generateDraft.js";
import { handler as submitEditHandler } from "./handlers/submitEdit.js";
import { handler as ingestNewsHandler } from "./handlers/ingestNews.js";
import { handler as ingestFeedHandler } from "./handlers/ingestFeed.js";
import { handler as healthHandler } from "./handlers/health.js";
import { handler as resetColdStartHandler } from "./handlers/resetColdStart.js";
import { handler as restoreSignalGhostHandler } from "./handlers/restoreSignalGhost.js";
import { handler as styleVectorMapHandler } from "./handlers/styleVectorMap.js";
import { BudgetExceededError } from "./lib/budget.js";

// Every route below is a thin adapter over the exact same handler function
// that would run behind API Gateway/Lambda in the deployed version — see
// AGENTS.md. Don't fork logic between this file and src/handlers/*.
const app = express();
app.use(cors());
app.use(express.json());

function mount(
  method: "get" | "post",
  path: string,
  handler: (event: LambdaEvent) => Promise<LambdaResponse>
) {
  app[method](path, async (req: Request, res: Response) => {
    const event: LambdaEvent = {
      body: req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : null,
      queryStringParameters: (req.query as Record<string, string>) ?? null,
      pathParameters: (req.params as Record<string, string>) ?? null,
    };
    try {
      const result = await handler(event);
      res.status(result.statusCode).set(result.headers).send(result.body);
    } catch (err) {
      console.error(err);
      const status = err instanceof BudgetExceededError ? 503 : 500;
      res.status(status).json({ error: (err as Error).message });
    }
  });
}

mount("get", "/feed", feedHandler);
mount("post", "/draft", generateDraftHandler);
mount("post", "/edit", submitEditHandler);
// /news is deliberately NOT mounted on the deployed Lambda (lambda-entry.ts)
// — it accepts arbitrary unvalidated content from any caller and triggers a
// real Bedrock call per request, so it's pure public attack surface with no
// product value (nothing in the deployed app calls it; /ingest uses
// upsertNewsItem directly). Kept here for local dev only, where the network
// is trusted.
mount("post", "/news", ingestNewsHandler);
mount("post", "/ingest", ingestFeedHandler);
mount("post", "/reset-cold-start", resetColdStartHandler);
mount("post", "/restore-signal-ghost", restoreSignalGhostHandler);
mount("get", "/style-vector-map", styleVectorMapHandler);
mount("get", "/health", healthHandler);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`ghostwire backend listening on http://localhost:${port}`));
