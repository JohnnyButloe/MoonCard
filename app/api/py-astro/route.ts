import { NextRequest, NextResponse } from "next/server";

import {
  cacheHeaders,
  fetchWithTimeout,
  noStoreHeaders,
  DEFAULT_TIMEOUT_MS,
} from "../../lib/apiUtils";
import {
  durationMsFrom,
  getOrCreateRequestId,
  isAbortLikeError,
  logServerEvent,
  withRequestIdHeaders,
} from "../../lib/serverObservability";
import {
  AstronomySummarySchema,
  MoonPhaseWindowSchema,
  PhasesQuerySchema,
  SummaryQuerySchema,
} from "./schemas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROUTE_PATH = "/api/py-astro";
const PRODUCT_ERROR_CODE = "py-astro-failed";
const PY_ASTRO_TIMEOUT_MS = Math.min(DEFAULT_TIMEOUT_MS, 5000);

type ValidQuery =
  | ReturnType<typeof SummaryQuerySchema.parse>
  | ReturnType<typeof PhasesQuerySchema.parse>;

function getPyRootUrl(): string | null {
  const baseUrl = process.env.PY_MOON_API;
  if (!baseUrl) {
    return null;
  }
  return baseUrl.replace(/\/moon\/?$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getSummaryPerformance(
  payload: unknown,
): Record<string, unknown> | null {
  if (!isRecord(payload)) {
    return null;
  }

  const meta = payload.meta;
  if (!isRecord(meta)) {
    return null;
  }

  const performance = meta.performance;
  return isRecord(performance) ? performance : null;
}

function productErrorResponse(status: number, requestId: string) {
  return NextResponse.json(
    { error: PRODUCT_ERROR_CODE },
    {
      status,
      headers: withRequestIdHeaders(noStoreHeaders, requestId),
    },
  );
}

function invalidParamsResponse(
  detail: unknown,
  requestId: string,
) {
  return NextResponse.json(
    { error: "invalid-params", detail },
    {
      status: 400,
      headers: withRequestIdHeaders(noStoreHeaders, requestId),
    },
  );
}

function logBoundaryEvent(
  level: "info" | "warn" | "error",
  requestId: string,
  fields: Record<string, unknown>,
) {
  logServerEvent(level, {
    route: ROUTE_PATH,
    requestId,
    ...fields,
  });
}

function parseQuery(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") ?? "summary";

  if (mode === "phases") {
    return PhasesQuerySchema.safeParse({
      mode,
      tz: searchParams.get("tz"),
      start_date_iso: searchParams.get("start_date_iso") ?? undefined,
      window_days: searchParams.get("window_days") ?? undefined,
    });
  }

  return SummaryQuerySchema.safeParse({
    mode,
    lat: searchParams.get("lat"),
    lon: searchParams.get("lon"),
    tz: searchParams.get("tz"),
    datetime_iso: searchParams.get("datetime_iso") ?? undefined,
    date_iso: searchParams.get("date_iso") ?? undefined,
    elev: searchParams.get("elev") ?? undefined,
    sun_path_samples: searchParams.get("sun_path_samples") ?? undefined,
  });
}

function buildUpstreamUrl(rootUrl: string, query: ValidQuery): URL {
  const upstreamPath =
    query.mode === "phases" ? "/astronomy/phases" : "/astronomy/summary";
  const url = new URL(`${rootUrl}${upstreamPath}`);

  for (const [key, value] of Object.entries(query)) {
    if (key === "mode" || value === undefined) {
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  return url;
}

function parseUpstreamJson(text: string): { ok: true; data: unknown } | { ok: false } {
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function hasValidUpstreamPayload(
  mode: ValidQuery["mode"],
  payload: unknown,
) {
  const schema =
    mode === "phases" ? MoonPhaseWindowSchema : AstronomySummarySchema;
  return schema.safeParse(payload);
}

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req);
  const rootUrl = getPyRootUrl();

  if (!rootUrl) {
    logBoundaryEvent("error", requestId, {
      msg: "missing-upstream-config",
    });
    return productErrorResponse(500, requestId);
  }

  const parsedQuery = parseQuery(req);
  if (!parsedQuery.success) {
    logBoundaryEvent("warn", requestId, {
      msg: "invalid-params",
      detail: parsedQuery.error.flatten(),
    });
    return invalidParamsResponse(parsedQuery.error.flatten(), requestId);
  }

  const upstreamUrl = buildUpstreamUrl(rootUrl, parsedQuery.data);
  const startedAt = Date.now();

  try {
    const upstreamResponse = await fetchWithTimeout(
      upstreamUrl.toString(),
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "X-Request-Id": requestId,
        },
      },
      PY_ASTRO_TIMEOUT_MS,
    );
    const upstreamText = await upstreamResponse.text();
    const latencyMs = durationMsFrom(startedAt);
    const upstreamRequestId = upstreamResponse.headers.get("x-request-id");

    if (!upstreamResponse.ok) {
      logBoundaryEvent("error", requestId, {
        msg: "upstream-non-ok",
        durationMs: latencyMs,
        mode: parsedQuery.data.mode,
        upstreamStatus: upstreamResponse.status,
        upstreamRequestId,
        upstreamUrl: upstreamUrl.toString(),
        upstreamBodyPreview: upstreamText.slice(0, 500),
      });
      return productErrorResponse(502, requestId);
    }

    const parsedJson = parseUpstreamJson(upstreamText);
    if (!parsedJson.ok) {
      logBoundaryEvent("error", requestId, {
        msg: "upstream-invalid-json",
        durationMs: latencyMs,
        mode: parsedQuery.data.mode,
        upstreamRequestId,
        upstreamUrl: upstreamUrl.toString(),
        upstreamBodyPreview: upstreamText.slice(0, 500),
      });
      return productErrorResponse(502, requestId);
    }

    const validatedPayload = hasValidUpstreamPayload(
      parsedQuery.data.mode,
      parsedJson.data,
    );
    if (!validatedPayload.success) {
      logBoundaryEvent("error", requestId, {
        msg: "upstream-invalid-payload",
        durationMs: latencyMs,
        mode: parsedQuery.data.mode,
        upstreamRequestId,
        upstreamUrl: upstreamUrl.toString(),
        issues: validatedPayload.error.issues.map((issue) => ({
          path: issue.path.join("."),
          code: issue.code,
        })),
      });
      return productErrorResponse(502, requestId);
    }

    const summaryPerformance = getSummaryPerformance(parsedJson.data);
    logBoundaryEvent("info", requestId, {
      msg: "request-complete",
      mode: parsedQuery.data.mode,
      durationMs: latencyMs,
      upstreamStatus: upstreamResponse.status,
      upstreamRequestId,
      pythonTotalMs:
        isRecord(summaryPerformance?.timings_ms) &&
        typeof summaryPerformance.timings_ms.total_ms === "number"
          ? summaryPerformance.timings_ms.total_ms
          : null,
      pythonCache:
        isRecord(summaryPerformance?.cache) ? summaryPerformance.cache : null,
    });

    return NextResponse.json(parsedJson.data, {
      headers: withRequestIdHeaders(cacheHeaders(), requestId),
    });
  } catch (err: unknown) {
    const latencyMs = durationMsFrom(startedAt);
    const status = isAbortLikeError(err) ? 504 : 502;

    logBoundaryEvent("error", requestId, {
      msg: status === 504 ? "upstream-timeout" : "upstream-network-failure",
      durationMs: latencyMs,
      mode: parsedQuery.data.mode,
      upstreamUrl: upstreamUrl.toString(),
      errorName: err instanceof Error ? err.name : "UnknownError",
      errorMessage: err instanceof Error ? err.message : String(err),
    });

    return productErrorResponse(status, requestId);
  }
}
