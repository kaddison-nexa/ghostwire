import { pool } from "../lib/db.js";
import { json, type LambdaEvent, type LambdaResponse } from "../lib/http.js";

// Used by the frontend's resilience panel: polled continuously while a node
// or region is killed against the demo cluster, to prove the memory layer
// (a real read+write, not just a TCP ping) stays available.
export const handler = async (_event: LambdaEvent): Promise<LambdaResponse> => {
  const start = Date.now();
  try {
    await pool.query("SELECT count(*) FROM style_profiles");
    return json(200, { ok: true, latencyMs: Date.now() - start });
  } catch (err) {
    return json(503, { ok: false, error: (err as Error).message, latencyMs: Date.now() - start });
  }
};
