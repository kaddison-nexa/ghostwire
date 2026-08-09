import { handler } from "../src/lambda-entry.js";

const httpContext = { method: "GET", sourceIp: "127.0.0.1" };

async function main() {
  const health = await handler({
    rawPath: "/health",
    requestContext: { http: httpContext },
  });
  console.log("GET /health ->", JSON.stringify(health));

  const feed = await handler({
    rawPath: "/feed",
    requestContext: { http: httpContext },
    queryStringParameters: { handle: "signal_ghost" },
  });
  const feedBody = JSON.parse(feed.body);
  console.log("GET /feed ->", feed.statusCode, `${feedBody.feed?.length ?? 0} items`);

  const notFound = await handler({
    rawPath: "/nope",
    requestContext: { http: httpContext },
  });
  console.log("GET /nope ->", notFound.statusCode);
}

main().then(() => process.exit(0));
