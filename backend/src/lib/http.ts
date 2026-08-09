// Minimal Lambda-shaped event/response types — enough to keep handlers
// deployable behind API Gateway without pulling in the full aws-lambda
// type package for a hackathon-scale demo.
export interface LambdaEvent {
  body: string | null;
  queryStringParameters: Record<string, string> | null;
  pathParameters: Record<string, string> | null;
}

export interface LambdaResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export function json(statusCode: number, data: unknown): LambdaResponse {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  };
}

export function parseBody<T>(event: LambdaEvent): T {
  return event.body ? (JSON.parse(event.body) as T) : ({} as T);
}
