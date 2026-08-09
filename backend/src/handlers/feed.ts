import { getPersonalizedFeed } from "../lib/triage.js";
import { getUserIdByHandle } from "../lib/users.js";
import { json, type LambdaEvent, type LambdaResponse } from "../lib/http.js";

export const handler = async (event: LambdaEvent): Promise<LambdaResponse> => {
  const handle = event.queryStringParameters?.handle;
  if (!handle) return json(400, { error: "handle is required" });

  const userId = await getUserIdByHandle(handle);
  if (!userId) return json(404, { error: `no user with handle "${handle}"` });

  const feed = await getPersonalizedFeed(userId);
  return json(200, { feed });
};
