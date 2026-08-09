import { handler } from "../src/lambda-entry.js";

async function main() {
  process.env.API_KEY = "test-secret";

  const noKey = await handler({
    rawPath: "/feed",
    requestContext: { http: { method: "GET", sourceIp: "203.0.113.5" } },
    headers: {},
  });
  console.log("no API key ->", noKey.statusCode, JSON.parse(noKey.body).error);

  const wrongKey = await handler({
    rawPath: "/feed",
    requestContext: { http: { method: "GET", sourceIp: "203.0.113.5" } },
    headers: { "x-ghostwire-key": "wrong" },
  });
  console.log("wrong API key ->", wrongKey.statusCode, JSON.parse(wrongKey.body).error);

  let last;
  for (let i = 1; i <= 16; i++) {
    last = await handler({
      rawPath: "/draft",
      requestContext: { http: { method: "POST", sourceIp: "203.0.113.99" } },
      headers: { "x-ghostwire-key": "test-secret" },
      body: JSON.stringify({ handle: "nope", newsItemId: "nope", platform: "x" }),
    });
  }
  console.log(`16th /draft call from same IP -> ${last!.statusCode} ${JSON.parse(last!.body).error ?? ""}`);
}

main().then(() => process.exit(0));
