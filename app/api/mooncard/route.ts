import { NextRequest, NextResponse } from "next/server";

import { noStoreHeaders } from "../../lib/apiUtils";
import { fetchMoonCardUpstream } from "../../lib/mooncard/fetchMooncardUpstream";
import {
  mapInternalRouteApiError,
  mapNormalizationApiError,
  mapUpstreamBadResponseApiError,
  mapUpstreamTimeoutApiError,
  mapValidationApiError,
} from "../../lib/mooncard/mapApiError";
import { normalizeMoonCardRequest } from "../../lib/mooncard/normalizeRequest";
import type { MoonCardApiResponse } from "../../lib/mooncard/types";

export const runtime = "nodejs";

function randomIncidentId(): string | null {
  return globalThis.crypto?.randomUUID?.() ?? null;
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
      headers: noStoreHeaders,
    });
  }

  try {
    const normalizedRequest = normalizeMoonCardRequest(requestBody);
    if (!normalizedRequest.ok) {
      return NextResponse.json(mapValidationApiError(normalizedRequest.errors).body, {
        status: 400,
        headers: noStoreHeaders,
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
            headers: noStoreHeaders,
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
            headers: noStoreHeaders,
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
            headers: noStoreHeaders,
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
            headers: noStoreHeaders,
          });
        }
      }
    }

    return NextResponse.json(
      {
        ok: true,
        data: upstreamResult.data,
      },
      {
        status: 200,
        headers: noStoreHeaders,
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
      headers: noStoreHeaders,
    });
  }
}
