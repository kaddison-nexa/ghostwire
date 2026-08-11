import "dotenv/config";
import { handler } from "../src/lambda-entry.js";

const httpContext = { method: "GET", sourceIp: "127.0.0.1" };
// Real backend/.env has API_KEY set (needed for the deployed Lambda), and
// lambda-entry.ts enforces it whenever process.env.API_KEY is truthy — so
// this smoke test needs the matching header or every call 401s regardless
// of what it's actually testing.
const headers: Record<string, string> = process.env.API_KEY ? { "x-ghostwire-key": process.env.API_KEY } : {};

async function main() {
  const health = await handler({
    rawPath: "/health",
    requestContext: { http: httpContext },
    headers,
  });
  console.log("GET /health ->", JSON.stringify(health));

  const feed = await handler({
    rawPath: "/feed",
    requestContext: { http: httpContext },
    queryStringParameters: { handle: "signal_ghost" },
    headers,
  });
  const feedBody = JSON.parse(feed.body);
  console.log("GET /feed ->", feed.statusCode, `${feedBody.feed?.length ?? 0} items`);

  const notFound = await handler({
    rawPath: "/nope",
    requestContext: { http: httpContext },
    headers,
  });
  console.log("GET /nope ->", notFound.statusCode);
}

main().then(() => process.exit(0));
