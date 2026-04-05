import { NextRequest, NextResponse } from "next/server";

import {
  cacheHeaders,
  fetchWithTimeout,
  noStoreHeaders,
  DEFAULT_TIMEOUT_MS,
} from "../../lib/apiUtils";
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

function getRequestId(req: NextRequest): string {
  const incomingId = req.headers.get("x-request-id")?.trim();
  if (incomingId) {
    return incomingId.slice(0, 200);
  }
  return crypto.randomUUID();
}

function withRequestIdHeaders(
  headersInit: HeadersInit,
  requestId: string,
): Headers {
  const headers = new Headers(headersInit);
  headers.set("x-request-id", requestId);
  return headers;
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
  requestId: string,
  fields: Record<string, unknown>,
) {
  console.error(
    JSON.stringify({
      level: "error",
      route: ROUTE_PATH,
      requestId,
      ...fields,
    }),
  );
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

function isAbortLikeError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }

  return (
    err.name === "AbortError" ||
    err.name === "TimeoutError" ||
    err.message.toLowerCase().includes("abort")
  );
}

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  const rootUrl = getPyRootUrl();

  if (!rootUrl) {
    logBoundaryEvent(requestId, {
      msg: "missing-upstream-config",
    });
    return productErrorResponse(500, requestId);
  }

  const parsedQuery = parseQuery(req);
  if (!parsedQuery.success) {
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
    const latencyMs = Date.now() - startedAt;

    if (!upstreamResponse.ok) {
      logBoundaryEvent(requestId, {
        msg: "upstream-non-ok",
        latencyMs,
        mode: parsedQuery.data.mode,
        upstreamStatus: upstreamResponse.status,
        upstreamUrl: upstreamUrl.toString(),
        upstreamBodyPreview: upstreamText.slice(0, 500),
      });
      return productErrorResponse(502, requestId);
    }

    const parsedJson = parseUpstreamJson(upstreamText);
    if (!parsedJson.ok) {
      logBoundaryEvent(requestId, {
        msg: "upstream-invalid-json",
        latencyMs,
        mode: parsedQuery.data.mode,
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
      logBoundaryEvent(requestId, {
        msg: "upstream-invalid-payload",
        latencyMs,
        mode: parsedQuery.data.mode,
        upstreamUrl: upstreamUrl.toString(),
        issues: validatedPayload.error.issues.map((issue) => ({
          path: issue.path.join("."),
          code: issue.code,
        })),
      });
      return productErrorResponse(502, requestId);
    }

    return NextResponse.json(parsedJson.data, {
      headers: withRequestIdHeaders(cacheHeaders(), requestId),
    });
  } catch (err: unknown) {
    const latencyMs = Date.now() - startedAt;
    const status = isAbortLikeError(err) ? 504 : 502;

    logBoundaryEvent(requestId, {
      msg: status === 504 ? "upstream-timeout" : "upstream-network-failure",
      latencyMs,
      mode: parsedQuery.data.mode,
      upstreamUrl: upstreamUrl.toString(),
      errorName: err instanceof Error ? err.name : "UnknownError",
      errorMessage: err instanceof Error ? err.message : String(err),
    });

    return productErrorResponse(status, requestId);
  }
}
