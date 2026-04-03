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

export const runtime = "nodejs";
const ALLOW_HEADER_VALUE = "POST, OPTIONS";

function randomIncidentId(): string | null {
  return globalThis.crypto?.randomUUID?.() ?? null;
}

function routeHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    ...noStoreHeaders,
    ...(extra ?? {}),
  };
}

function logRouteError(message: string, details?: Record<string, unknown> | null) {
  console.error(
    JSON.stringify({
      level: "error",
      route: "/api/mooncard",
      msg: message,
      ...(details ?? {}),
    }),
  );
}

function methodNotAllowedResponse(
  request: NextRequest,
): NextResponse<MoonCardApiResponse> {
  const mapped = mapMethodNotAllowedApiError({
    method: request.method,
    allowed_methods: ["POST"],
  });

  return NextResponse.json(mapped.body, {
    status: mapped.status,
    headers: routeHeaders({
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
  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
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
      headers: routeHeaders(),
    });
  }

  try {
    const normalizedRequest = normalizeMoonCardRequest(requestBody);
    if (!normalizedRequest.ok) {
      return NextResponse.json(mapValidationApiError(normalizedRequest.errors).body, {
        status: 400,
        headers: routeHeaders(),
      });
    }

    const upstreamResult = await fetchMoonCardUpstream(normalizedRequest.value);

    if (!upstreamResult.ok) {
      switch (upstreamResult.kind) {
        case "invalid_request_payload": {
          logRouteError("normalization-failed", {
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
            headers: routeHeaders(),
          });
        }
        case "unconfigured": {
          logRouteError("upstream-unconfigured");
          const mapped = mapInternalRouteApiError({
            message: upstreamResult.message,
            incident_id: randomIncidentId(),
            details: upstreamResult.details,
          });
          return NextResponse.json(mapped.body, {
            status: mapped.status,
            headers: routeHeaders(),
          });
        }
        case "timeout": {
          logRouteError("upstream-timeout", {
            details: upstreamResult.details,
          });
          const mapped = mapUpstreamTimeoutApiError({
            details: upstreamResult.details,
          });
          return NextResponse.json(mapped.body, {
            status: mapped.status,
            headers: routeHeaders(),
          });
        }
        case "bad_response":
        case "invalid_response": {
          logRouteError("upstream-bad-response", {
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
            headers: routeHeaders(),
          });
        }
      }
    }

    const normalizedResponse = normalizeMoonCardResponse(
      upstreamResult.data,
      normalizedRequest.value,
    );
    if (!normalizedResponse.ok) {
      logRouteError("response-normalization-failed", {
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
        headers: routeHeaders(),
      });
    }

    return NextResponse.json(
      {
        ok: true,
        data: normalizedResponse.value,
      },
      {
        status: 200,
        headers: routeHeaders({
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

    logRouteError("internal-route-error", {
      error: message,
    });

    return NextResponse.json(mapped.body, {
      status: mapped.status,
      headers: routeHeaders(),
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
  return new NextResponse(null, {
    status: 204,
    headers: routeHeaders({
      Allow: ALLOW_HEADER_VALUE,
    }),
  });
}
