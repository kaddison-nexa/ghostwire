// Bundles src/lambda-entry.ts (and every handler/lib it pulls in) into a
// single CJS file via esbuild, then zips it into backend/lambda.zip — the
// artifact `aws lambda create-function --zip-file` / `update-function-code`
// expects. No node_modules to ship separately since everything's inlined.
import { build } from "esbuild";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(__dirname, "..");
const outDir = join(backendRoot, "dist-lambda");
const zipPath = join(backendRoot, "lambda.zip");

if (existsSync(outDir)) rmSync(outDir, { recursive: true });
mkdirSync(outDir);
if (existsSync(zipPath)) rmSync(zipPath);

await build({
  entryPoints: [join(backendRoot, "src", "lambda-entry.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: join(outDir, "index.js"),
  logLevel: "info",
});

execFileSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-Command",
    `Compress-Archive -Path '${join(outDir, "*")}' -DestinationPath '${zipPath}' -Force`,
  ],
  { stdio: "inherit" }
);

console.log(`\nbuilt ${zipPath}`);
