import { pool, toVectorLiteral, parseVectorLiteral, withSerializableRetry } from "./db.js";
import type { Platform } from "./types.js";

export interface StyleProfile {
  styleVector: number[] | null;
  sampleCount: number;
}

export async function getStyleProfile(userId: string, platform: Platform): Promise<StyleProfile> {
  const { rows } = await pool.query(
    `SELECT style_vector, sample_count FROM style_profiles WHERE user_id = $1 AND platform = $2`,
    [userId, platform]
  );
  if (rows.length === 0) return { styleVector: null, sampleCount: 0 };
  return {
    styleVector: parseVectorLiteral(rows[0].style_vector),
    sampleCount: rows[0].sample_count,
  };
}

export async function nearestEdits(
  userId: string,
  platform: Platform,
  targetVector: number[],
  limit = 5
): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT edited_text FROM edits
     WHERE user_id = $1 AND platform = $2
     ORDER BY edit_vector <-> $3::VECTOR
     LIMIT $4`,
    [userId, platform, toVectorLiteral(targetVector), limit]
  );
  return rows.map((r) => r.edited_text);
}

/**
 * The one transaction the whole memory story depends on: the edit and the
 * style-profile update happen atomically, so a concurrent draft-generation
 * read never sees the edit event without the profile reflecting it (or the
 * reverse). Running average keeps the profile a single vector rather than an
 * ever-growing set the caller has to re-aggregate.
 */
export async function recordEditAndUpdateStyle(params: {
  draftId: string;
  userId: string;
  platform: Platform;
  editedText: string;
  editVector: number[];
}): Promise<{ sampleCount: number }> {
  return withSerializableRetry(async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO edits (draft_id, user_id, platform, edited_text, edit_vector)
         VALUES ($1, $2, $3, $4, $5::VECTOR)`,
        [params.draftId, params.userId, params.platform, params.editedText, toVectorLiteral(params.editVector)]
      );

      const { rows } = await client.query(
        `SELECT style_vector, sample_count FROM style_profiles
         WHERE user_id = $1 AND platform = $2 FOR UPDATE`,
        [params.userId, params.platform]
      );

      let newVector: number[];
      let newCount: number;
      if (rows.length === 0) {
        newVector = params.editVector;
        newCount = 1;
      } else {
        const oldVector = parseVectorLiteral(rows[0].style_vector);
        const oldCount = rows[0].sample_count as number;
        newCount = oldCount + 1;
        newVector = oldVector.map((v, i) => (v * oldCount + params.editVector[i]) / newCount);
      }

      await client.query(
        `INSERT INTO style_profiles (user_id, platform, style_vector, sample_count, updated_at)
         VALUES ($1, $2, $3::VECTOR, $4, now())
         ON CONFLICT (user_id, platform)
         DO UPDATE SET style_vector = $3::VECTOR, sample_count = $4, updated_at = now()`,
        [params.userId, params.platform, toVectorLiteral(newVector), newCount]
      );

      await client.query("COMMIT");
      return { sampleCount: newCount };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });
}
