import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import "dotenv/config";
import { chargeBudget } from "./budget.js";

// Per-call cost estimates in micro-USD, deliberately padded above realistic
// actual cost (see budget.ts for why): Titan Embed V2 is ~$0.02/M tokens and
// our inputs are short (headline+summary or a single post) — $0.0001/call
// is generous. Claude Sonnet 4.5 is $3/M input + $15/M output; our output is
// capped at maxTokens (default 400) and prompts run a few hundred tokens
// with exemplars, so $0.015/call comfortably covers the realistic ~$0.01.
const EMBED_COST_MICRO_USD = 100; // $0.0001
const GENERATE_COST_MICRO_USD = 15_000; // $0.015

const EMBED_DIM = 1024; // Titan Text Embeddings V2 default output size
const EMBED_MODEL_ID = "amazon.titan-embed-text-v2:0";
// eu-west-2 (and eu-west-1) don't support on-demand invocation of newer Claude
// models by bare model ID — they require a cross-region inference profile
// (the "eu." prefix), or the call fails with "on-demand throughput isn't
// supported for this model." If you change AWS_REGION outside the EU, this
// prefix needs to change (or drop to a bare model ID if the region supports
// on-demand invocation directly).
const GEN_MODEL_ID = "eu.anthropic.claude-sonnet-4-5-20250929-v1:0";

const mockMode =
  process.env.MOCK_LLM === "true" ||
  (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_PROFILE && !process.env.AWS_ROLE_ARN);

let client: BedrockRuntimeClient | null = null;
function getClient(): BedrockRuntimeClient {
  if (!client) client = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? "us-east-1" });
  return client;
}

// Deterministic pseudo-embedding for local UI dev without AWS credentials.
// Not semantically meaningful — just stable so the UI has something to render.
function mockEmbedding(text: string): number[] {
  let seed = 0;
  for (let i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
  const vec: number[] = [];
  for (let i = 0; i < EMBED_DIM; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    vec.push((seed % 2000) / 1000 - 1); // range [-1, 1]
  }
  return vec;
}

export async function embedText(text: string): Promise<number[]> {
  if (mockMode) return mockEmbedding(text);
  await chargeBudget(EMBED_COST_MICRO_USD);

  const res = await getClient().send(
    new InvokeModelCommand({
      modelId: EMBED_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({ inputText: text }),
    })
  );
  const payload = JSON.parse(new TextDecoder().decode(res.body));
  return payload.embedding as number[];
}

export async function generateText(params: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  if (mockMode) {
    return `[mock draft — set AWS credentials and MOCK_LLM=false for real Bedrock output]\n\n${params.prompt.slice(0, 240)}`;
  }
  await chargeBudget(GENERATE_COST_MICRO_USD);

  const res = await getClient().send(
    new InvokeModelCommand({
      modelId: GEN_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: params.maxTokens ?? 400,
        system: params.system,
        messages: [{ role: "user", content: params.prompt }],
      }),
    })
  );
  const payload = JSON.parse(new TextDecoder().decode(res.body));
  return payload.content?.[0]?.text ?? "";
}

export const isMockMode = mockMode;
