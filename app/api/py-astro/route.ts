import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  cacheHeaders,
  fetchWithTimeout,
  noStoreHeaders,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_TTL_SECONDS,
} from "../../lib/apiUtils";

function getPyRootUrl(): string | null {
  const baseUrl = process.env.PY_MOON_API;
  if (!baseUrl) return null;
  return baseUrl.replace(/\/moon\/?$/, "");
}

const SummaryQuery = z.object({
  mode: z.literal("summary"),
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  tz: z.string().min(1).max(100),
  datetime_iso: z.string().datetime({ offset: true }).optional(),
  date_iso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  elev: z.coerce.number().optional(),
  sun_path_samples: z.coerce.number().int().min(24).max(480).optional(),
});

const PhasesQuery = z.object({
  mode: z.literal("phases"),
  tz: z.string().min(1).max(100),
  start_date_iso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  window_days: z.coerce.number().int().min(7).max(84).optional(),
});

export async function GET(req: NextRequest) {
  const rootUrl = getPyRootUrl();
  if (!rootUrl) {
    return NextResponse.json(
      { error: "missing PY_MOON_API" },
      { status: 500, headers: noStoreHeaders },
    );
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") ?? "summary";
  const parsed =
    mode === "phases"
      ? PhasesQuery.safeParse({
          mode,
          tz: searchParams.get("tz"),
          start_date_iso: searchParams.get("start_date_iso") ?? undefined,
          window_days: searchParams.get("window_days") ?? undefined,
        })
      : SummaryQuery.safeParse({
          mode,
          lat: searchParams.get("lat"),
          lon: searchParams.get("lon"),
          tz: searchParams.get("tz"),
          datetime_iso: searchParams.get("datetime_iso") ?? undefined,
          date_iso: searchParams.get("date_iso") ?? undefined,
          elev: searchParams.get("elev") ?? undefined,
          sun_path_samples: searchParams.get("sun_path_samples") ?? undefined,
        });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-params", detail: parsed.error.flatten() },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const upstreamPath =
    parsed.data.mode === "phases" ? "/astronomy/phases" : "/astronomy/summary";
  const url = new URL(`${rootUrl}${upstreamPath}`);

  for (const [key, value] of Object.entries(parsed.data)) {
    if (key === "mode" || value === undefined) continue;
    url.searchParams.set(key, String(value));
  }

  const start = Date.now();
  try {
    const res = await fetchWithTimeout(
      url.toString(),
      { next: { revalidate: DEFAULT_TTL_SECONDS } },
      DEFAULT_TIMEOUT_MS,
    );
    const text = await res.text();
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      console.error(
        JSON.stringify({
          level: "error",
          route: "/api/py-astro",
          msg: "upstream-failed",
          status: res.status,
          latencyMs,
          url: url.toString(),
          body: text.slice(0, 500),
        }),
      );
      return NextResponse.json(
        { error: "py-astro-failed", status: res.status },
        { status: 502, headers: noStoreHeaders },
      );
    }

    return NextResponse.json(JSON.parse(text), { headers: cacheHeaders() });
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/py-astro",
        msg: "upstream-exception",
        latencyMs,
        url: url.toString(),
        error: message,
      }),
    );
    const status =
      name.includes("AbortError") || message.includes("abort") ? 504 : 502;
    return NextResponse.json(
      { error: "py-astro-exception", detail: message },
      { status, headers: noStoreHeaders },
    );
  }
}
