import { NextRequest, NextResponse } from "next/server";

import { noStoreHeaders } from "../../lib/apiUtils";
import { fetchMoonCardUpstream } from "../../lib/mooncard/fetchMooncardUpstream";
import {
  mapInternalRouteApiError,
  mapMethodNotAllowedApiError,
  mapNormalizationApiError,
  mapUpstreamBadResponseApiError,
  mapUpstreamTimeoutApiError,
  mapValidationApiError,
} from "../../lib/mooncard/mapApiError";
import { normalizeMoonCardResponse } from "../../lib/mooncard/normalizeResponse";
import { normalizeMoonCardRequest } from "../../lib/mooncard/normalizeRequest";
import type { MoonCardApiResponse } from "../../lib/mooncard/types";
import {
  durationMsFrom,
  getOrCreateRequestId,
  logServerEvent,
  withRequestIdHeaders,
} from "../../lib/serverObservability";

export const runtime = "nodejs";
const ALLOW_HEADER_VALUE = "POST, OPTIONS";

function randomIncidentId(): string | null {
  return globalThis.crypto?.randomUUID?.() ?? null;
}

function routeHeaders(
  requestId: string,
  extra?: Record<string, string>,
): Headers {
  return withRequestIdHeaders(
    {
      ...noStoreHeaders,
      ...(extra ?? {}),
    },
    requestId,
  );
}

function logRouteEvent(
  level: "info" | "warn" | "error",
  requestId: string,
  message: string,
  details?: Record<string, unknown> | null,
) {
  logServerEvent(level, {
      route: "/api/mooncard",
      requestId,
      msg: message,
      ...(details ?? {}),
    });
}

function methodNotAllowedResponse(
  request: NextRequest,
): NextResponse<MoonCardApiResponse> {
  const requestId = getOrCreateRequestId(request);
  const mapped = mapMethodNotAllowedApiError({
    method: request.method,
    allowed_methods: ["POST"],
  });

  return NextResponse.json(mapped.body, {
    status: mapped.status,
    headers: routeHeaders(requestId, {
      Allow: ALLOW_HEADER_VALUE,
    }),
  });
}

/**
 * This route is the application boundary for the canonical MoonCard data path.
 * It is intentionally limited to request parsing, normalization, upstream
 * orchestration, and response/error mapping. Astronomy calculations stay in the
 * Python service.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<MoonCardApiResponse>> {
  const requestId = getOrCreateRequestId(request);
  const startedAt = Date.now();
  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logRouteEvent("warn", requestId, "invalid-json-body", {
      durationMs: durationMsFrom(startedAt),
      error: message,
    });
    const mapped = mapValidationApiError([
      {
        type: "validation",
        code: "invalid_request",
        message: "Request body must be valid JSON.",
        field: null,
        retryable: false,
        details: {
          error: message,
        },
      },
    ]);

    return NextResponse.json(mapped.body, {
      status: mapped.status,
      headers: routeHeaders(requestId),
    });
  }

  try {
    const normalizedRequest = normalizeMoonCardRequest(requestBody);
    if (!normalizedRequest.ok) {
      logRouteEvent("warn", requestId, "validation-failed", {
        durationMs: durationMsFrom(startedAt),
        errors: normalizedRequest.errors,
      });
      return NextResponse.json(mapValidationApiError(normalizedRequest.errors).body, {
        status: 400,
        headers: routeHeaders(requestId),
      });
    }

    const upstreamResult = await fetchMoonCardUpstream(normalizedRequest.value, {
      requestId,
    });

    if (!upstreamResult.ok) {
      switch (upstreamResult.kind) {
        case "invalid_request_payload": {
          logRouteEvent("error", requestId, "normalization-failed", {
            durationMs: durationMsFrom(startedAt),
            upstreamDurationMs: upstreamResult.duration_ms,
            upstreamRequestId: upstreamResult.upstream_request_id,
            details: upstreamResult.details,
          });
          const mapped = mapNormalizationApiError({
            message:
              "The normalized MoonCard request could not be mapped into a valid upstream payload.",
            stage: "python_payload",
            details: upstreamResult.details,
          });
          return NextResponse.json(mapped.body, {
            status: mapped.status,
            headers: routeHeaders(requestId),
          });
        }
        case "unconfigured": {
          logRouteEvent("error", requestId, "upstream-unconfigured", {
            durationMs: durationMsFrom(startedAt),
          });
          const mapped = mapInternalRouteApiError({
            message: upstreamResult.message,
            incident_id: randomIncidentId(),
            details: upstreamResult.details,
          });
          return NextResponse.json(mapped.body, {
            status: mapped.status,
            headers: routeHeaders(requestId),
          });
        }
        case "timeout": {
          logRouteEvent("error", requestId, "upstream-timeout", {
            durationMs: durationMsFrom(startedAt),
            upstreamDurationMs: upstreamResult.duration_ms,
            upstreamRequestId: upstreamResult.upstream_request_id,
            details: upstreamResult.details,
          });
          const mapped = mapUpstreamTimeoutApiError({
            details: upstreamResult.details,
          });
          return NextResponse.json(mapped.body, {
            status: mapped.status,
            headers: routeHeaders(requestId),
          });
        }
        case "bad_response":
        case "invalid_response": {
          logRouteEvent("error", requestId, "upstream-bad-response", {
            durationMs: durationMsFrom(startedAt),
            upstreamDurationMs: upstreamResult.duration_ms,
            upstreamRequestId: upstreamResult.upstream_request_id,
            upstream_status: upstreamResult.upstream_status,
            details: upstreamResult.details,
          });
          const mapped = mapUpstreamBadResponseApiError({
            code:
              upstreamResult.kind === "invalid_response"
                ? "upstream_invalid_response"
                : "upstream_unavailable",
            message: upstreamResult.message,
            upstream_status: upstreamResult.upstream_status,
            details: upstreamResult.details,
            retryable: upstreamResult.kind !== "invalid_response",
          });
          return NextResponse.json(mapped.body, {
            status: mapped.status,
            headers: routeHeaders(requestId),
          });
        }
      }
    }

    const normalizedResponse = normalizeMoonCardResponse(
      upstreamResult.data,
      normalizedRequest.value,
    );
    if (!normalizedResponse.ok) {
      logRouteEvent("error", requestId, "response-normalization-failed", {
        durationMs: durationMsFrom(startedAt),
        upstreamDurationMs: upstreamResult.duration_ms,
        upstreamRequestId: upstreamResult.upstream_request_id,
        details: normalizedResponse.errors,
      });
      const primaryError = normalizedResponse.errors[0];
      const mapped = mapNormalizationApiError({
        message: primaryError?.message ?? "MoonCard response normalization failed.",
        stage: primaryError?.stage ?? "python_response",
        details: {
          errors: normalizedResponse.errors,
        },
      });
      return NextResponse.json(mapped.body, {
        status: mapped.status,
        headers: routeHeaders(requestId),
      });
    }

    logRouteEvent("info", requestId, "request-complete", {
      durationMs: durationMsFrom(startedAt),
      upstreamDurationMs: upstreamResult.duration_ms,
      upstreamRequestId: upstreamResult.upstream_request_id,
      location: {
        lat: normalizedRequest.value.pythonPayload.lat,
        lon: normalizedRequest.value.pythonPayload.lon,
      },
      timezone: normalizedRequest.value.pythonPayload.timezone,
      localDate: normalizedRequest.value.pythonPayload.local_date,
      requestOrigin: normalizedRequest.value.requestOrigin,
    });

    return NextResponse.json(
      {
        ok: true,
        data: normalizedResponse.value,
      },
      {
        status: 200,
        headers: routeHeaders(requestId, {
          Allow: ALLOW_HEADER_VALUE,
        }),
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const mapped = mapInternalRouteApiError({
      message: "MoonCard route failed before a response could be generated.",
      incident_id: randomIncidentId(),
      details: {
        error: message,
      },
    });

    logRouteEvent("error", requestId, "internal-route-error", {
      durationMs: durationMsFrom(startedAt),
      error: message,
    });

    return NextResponse.json(mapped.body, {
      status: mapped.status,
      headers: routeHeaders(requestId),
    });
  }
}

export function GET(request: NextRequest): NextResponse<MoonCardApiResponse> {
  return methodNotAllowedResponse(request);
}

export function PUT(request: NextRequest): NextResponse<MoonCardApiResponse> {
  return methodNotAllowedResponse(request);
}

export function PATCH(request: NextRequest): NextResponse<MoonCardApiResponse> {
  return methodNotAllowedResponse(request);
}

export function DELETE(request: NextRequest): NextResponse<MoonCardApiResponse> {
  return methodNotAllowedResponse(request);
}

export function OPTIONS(): NextResponse<null> {
  const requestId = globalThis.crypto?.randomUUID?.() ?? "mooncard-options";
  return new NextResponse(null, {
    status: 204,
    headers: routeHeaders(requestId, {
      Allow: ALLOW_HEADER_VALUE,
    }),
  });
}
