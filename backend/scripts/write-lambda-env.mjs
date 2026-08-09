// Builds the --environment JSON file for `aws lambda update-function-configuration`
// by reading backend/.env directly on disk — deliberately never prints
// DATABASE_URL to stdout/stderr, so it doesn't end up in shell history or
// terminal scrollback. The AWS access key/secret in .env are NOT included
// here on purpose: inside Lambda, Bedrock calls should use the execution
// role's temporary credentials (see deploy/lambda-bedrock-policy.json), not
// static keys baked into function config.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const envText = readFileSync(join(backendRoot, ".env"), "utf-8");

function get(key) {
  const line = envText.split("\n").find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : "";
}

const config = {
  // AWS_REGION is a Lambda-reserved env var populated automatically by the
  // runtime (from the function's deployment region) — setting it ourselves
  // is rejected by UpdateFunctionConfiguration.
  Variables: {
    DATABASE_URL: get("DATABASE_URL"),
    MOCK_LLM: "false",
    API_KEY: get("API_KEY"),
  },
};

const outPath = join(backendRoot, "deploy", "lambda-env.generated.json");
writeFileSync(outPath, JSON.stringify(config, null, 2));
console.log("wrote deploy/lambda-env.generated.json (gitignored; deploy.sh deletes it after use)");
