import { randomUUID as uuid } from "node:crypto";
import { pool } from "../lib/db.js";
import { embedText, generateText } from "../lib/bedrock.js";
import { getStyleProfile, nearestEdits } from "../lib/memory.js";
import { recordEngagement } from "../lib/triage.js";
import { getUserIdByHandle } from "../lib/users.js";
import { json, parseBody, type LambdaEvent, type LambdaResponse } from "../lib/http.js";
import type { Platform } from "../lib/types.js";

interface GenerateDraftBody {
  handle: string;
  newsItemId: string;
  platform: Platform;
}

const PLATFORM_BRIEF: Record<Platform, string> = {
  linkedin: "a longer-form, professional LinkedIn post (3-5 sentences, no hashtag spam)",
  x: "a terse, punchy X/Twitter post under 280 characters",
  threads: "a casual, conversational Threads post",
};

export const handler = async (event: LambdaEvent): Promise<LambdaResponse> => {
  const { handle, newsItemId, platform } = parseBody<GenerateDraftBody>(event);
  if (!handle || !newsItemId || !platform) {
    return json(400, { error: "handle, newsItemId, and platform are required" });
  }

  const userId = await getUserIdByHandle(handle);
  if (!userId) return json(404, { error: `no user with handle "${handle}"` });

  const { rows } = await pool.query(
    `SELECT headline, summary FROM news_items WHERE id = $1`,
    [newsItemId]
  );
  if (rows.length === 0) return json(404, { error: "news item not found" });
  const { headline, summary } = rows[0];

  const profile = await getStyleProfile(userId, platform);
  const exemplars = profile.styleVector
    ? await nearestEdits(userId, platform, profile.styleVector, 5)
    : [];

  const system = [
    "You are a ghostwriter drafting a social media post for a cybersecurity professional building their personal brand.",
    `Write ${PLATFORM_BRIEF[platform]}.`,
    exemplars.length > 0
      ? `Match this person's established voice. Examples of posts they've previously written/edited:\n${exemplars
          .map((e, i) => `${i + 1}. ${e}`)
          .join("\n")}`
      : "No prior writing samples exist yet for this person — write a solid, neutral first draft; their edits will teach future drafts their voice.",
  ].join("\n\n");

  const prompt = `Breaking story:\nHeadline: ${headline}\nSummary: ${summary}\n\nDraft the post.`;

  const generatedText = await generateText({ system, prompt });

  const { rows: draftRows } = await pool.query(
    `INSERT INTO drafts (id, user_id, news_item_id, platform, generated_text, used_style_sample_count)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
    [uuid(), userId, newsItemId, platform, generatedText, profile.sampleCount]
  );

  await recordEngagement(userId, newsItemId, "drafted");

  return json(201, {
    draft: {
      id: draftRows[0].id,
      handle,
      newsItemId,
      platform,
      generatedText,
      usedStyleSampleCount: profile.sampleCount,
      createdAt: draftRows[0].created_at,
    },
  });
};
