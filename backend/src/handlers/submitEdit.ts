import { pool } from "../lib/db.js";
import { embedText } from "../lib/bedrock.js";
import { recordEditAndUpdateStyle } from "../lib/memory.js";
import { getUserIdByHandle } from "../lib/users.js";
import { json, parseBody, type LambdaEvent, type LambdaResponse } from "../lib/http.js";
import type { Platform } from "../lib/types.js";

interface SubmitEditBody {
  draftId: string;
  handle: string;
  platform: Platform;
  editedText: string;
}

export const handler = async (event: LambdaEvent): Promise<LambdaResponse> => {
  const { draftId, handle, platform, editedText } = parseBody<SubmitEditBody>(event);
  if (!draftId || !handle || !platform || !editedText) {
    return json(400, { error: "draftId, handle, platform, and editedText are required" });
  }

  const userId = await getUserIdByHandle(handle);
  if (!userId) return json(404, { error: `no user with handle "${handle}"` });

  const { rows } = await pool.query(`SELECT id FROM drafts WHERE id = $1`, [draftId]);
  if (rows.length === 0) return json(404, { error: "draft not found" });

  const editVector = await embedText(editedText);
  const { sampleCount } = await recordEditAndUpdateStyle({
    draftId,
    userId,
    platform,
    editedText,
    editVector,
  });

  return json(200, { sampleCount });
};
