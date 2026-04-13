import { z } from "zod";

import {
  DEFAULT_TIMEOUT_MS,
  fetchWithTimeout,
} from "../apiUtils";
import { isAbortLikeError, REQUEST_ID_HEADER } from "../serverObservability";
import type { MoonCardNormalizedRequest } from "./normalizeRequest";

function getPyRootUrl(): string | null {
  const baseUrl = process.env.PY_MOON_API;
  if (!baseUrl) return null;
  return baseUrl.replace(/\/moon\/?$/, "");
}

const MoonCardPythonPayloadSchema = z
  .object({
    lat: z.number().finite().min(-90).max(90),
    lon: z.number().finite().min(-180).max(180),
    label: z.string().nullable(),
    timezone: z.string().min(1).max(100),
    local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    local_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    timestamp_iso: z.string().datetime({ offset: true }),
    include_sun: z.boolean(),
    include_moon: z.boolean(),
    include_twilight: z.boolean(),
    include_visibility: z.boolean(),
  })
  .strict();

export type FetchMoonCardUpstreamResult =
  | {
      ok: true;
      data: unknown;
      duration_ms: number;
      upstream_request_id: string | null;
    }
  | {
      ok: false;
      kind:
        | "invalid_request_payload"
        | "unconfigured"
        | "timeout"
        | "bad_response"
        | "invalid_response";
      message: string;
      upstream_status: number | null;
      details: Record<string, unknown> | null;
      duration_ms: number | null;
      upstream_request_id: string | null;
    };

export async function fetchMoonCardUpstream(
  normalizedRequest: MoonCardNormalizedRequest,
  options?: {
    requestId?: string | null;
  },
): Promise<FetchMoonCardUpstreamResult> {
  const parsedPayload = MoonCardPythonPayloadSchema.safeParse(
    normalizedRequest.pythonPayload,
  );

  if (!parsedPayload.success) {
    return {
      ok: false,
      kind: "invalid_request_payload",
      message: "Normalized MoonCard request payload failed internal validation.",
      upstream_status: null,
      details: parsedPayload.error.flatten(),
      duration_ms: null,
      upstream_request_id: null,
    };
  }

  const rootUrl = getPyRootUrl();
  if (!rootUrl) {
    return {
      ok: false,
      kind: "unconfigured",
      message: "PY_MOON_API is not configured for the MoonCard route.",
      upstream_status: null,
      details: null,
      duration_ms: null,
      upstream_request_id: null,
    };
  }

  const payload = parsedPayload.data;
  // This normalized payload is the single orchestration contract between Next
  // and Python. Future cache layers can key off this exact shape without
  // teaching React components anything about Python transport details.
  const url = new URL(`${rootUrl}/mooncard`);
  const startedAt = Date.now();

  try {
    const response = await fetchWithTimeout(
      url.toString(),
      {
        cache: "no-store",
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(options?.requestId
            ? {
                [REQUEST_ID_HEADER]: options.requestId,
              }
            : {}),
        },
        body: JSON.stringify(payload),
      },
      DEFAULT_TIMEOUT_MS,
    );

    const rawBody = await response.text();
    const durationMs = Date.now() - startedAt;
    const upstreamRequestId = response.headers.get(REQUEST_ID_HEADER);

    if (!response.ok) {
      const parsedErrorBody = (() => {
        try {
          return JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          return { body: rawBody.slice(0, 500) };
        }
      })();

      return {
        ok: false,
        kind:
          response.status === 400 || response.status === 422
            ? "invalid_request_payload"
            : "bad_response",
        message:
          response.status === 400 || response.status === 422
            ? "The Python MoonCard route rejected the normalized request payload."
            : "The Python microservice returned a non-success response.",
        upstream_status: response.status,
        details: parsedErrorBody,
        duration_ms: durationMs,
        upstream_request_id: upstreamRequestId,
      };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        kind: "invalid_response",
        message: "The Python microservice returned invalid JSON.",
        upstream_status: response.status,
        details: {
          body: rawBody.slice(0, 500),
          error: message,
        },
        duration_ms: durationMs,
        upstream_request_id: upstreamRequestId,
      };
    }

    return {
      ok: true,
      data: parsedJson,
      duration_ms: durationMs,
      upstream_request_id: upstreamRequestId,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - startedAt;

    return {
      ok: false,
      kind: isAbortLikeError(error) ? "timeout" : "bad_response",
      message,
      upstream_status: null,
      details: {
        error: message,
      },
      duration_ms: durationMs,
      upstream_request_id: null,
    };
  }
}
