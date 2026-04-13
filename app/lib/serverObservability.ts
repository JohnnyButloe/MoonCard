import type { NextRequest } from "next/server";

export const REQUEST_ID_HEADER = "x-request-id";

export type ServerLogLevel = "info" | "warn" | "error";

export function getOrCreateRequestId(request: NextRequest): string {
  const incomingId = request.headers.get(REQUEST_ID_HEADER)?.trim();
  if (incomingId) {
    return incomingId.slice(0, 200);
  }
  return crypto.randomUUID();
}

export function withRequestIdHeaders(
  headersInit: HeadersInit,
  requestId: string,
): Headers {
  const headers = new Headers(headersInit);
  headers.set(REQUEST_ID_HEADER, requestId);
  return headers;
}

export function durationMsFrom(startedAt: number): number {
  return Date.now() - startedAt;
}

export function isAbortLikeError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }

  return (
    err.name === "AbortError" ||
    err.name === "TimeoutError" ||
    err.message.toLowerCase().includes("abort")
  );
}

export function logServerEvent(
  level: ServerLogLevel,
  fields: Record<string, unknown>,
) {
  const payload = JSON.stringify({
    level,
    timestamp_utc: new Date().toISOString(),
    ...fields,
  });

  if (level === "error") {
    console.error(payload);
    return;
  }

  if (level === "warn") {
    console.warn(payload);
    return;
  }

  console.info(payload);
}
