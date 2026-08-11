import { pool, parseVectorLiteral } from "../lib/db.js";
import { getUserIdByHandle } from "../lib/users.js";
import { projectTo2D } from "../lib/vectorProjection.js";
import { json, type LambdaEvent, type LambdaResponse } from "../lib/http.js";

// Read-only — no Bedrock calls, just projecting vectors already in the DB.
// Powers the "voice vector map" visualization in the draft modal.
export const handler = async (event: LambdaEvent): Promise<LambdaResponse> => {
  const handle = event.queryStringParameters?.handle;
  if (!handle) return json(400, { error: "handle is required" });

  const userId = await getUserIdByHandle(handle);
  if (!userId) return json(404, { error: `no user with handle "${handle}"` });

  const { rows: editRows } = await pool.query(
    `SELECT platform, edit_vector, created_at FROM edits WHERE user_id = $1 ORDER BY created_at`,
    [userId]
  );
  const edits = editRows.map((r) => {
    const { x, y } = projectTo2D(parseVectorLiteral(r.edit_vector));
    return { platform: r.platform, x, y, createdAt: r.created_at };
  });

  const { rows: profileRows } = await pool.query(
    `SELECT platform, style_vector FROM style_profiles WHERE user_id = $1`,
    [userId]
  );
  const current: Record<string, { x: number; y: number }> = {};
  for (const row of profileRows) {
    current[row.platform] = projectTo2D(parseVectorLiteral(row.style_vector));
  }

  return json(200, { edits, current });
};
