// app/api/py-twilight/route.ts
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

  // If your env is ".../moon" (common), strip it so we can call "/twilight/events"
  return baseUrl.replace(/\/moon\/?$/, "");
}

export async function GET(req: NextRequest) {
  const rootUrl = getPyRootUrl();
  if (!rootUrl) {
    return NextResponse.json(
      { error: "missing PY_MOON_API" },
      { status: 500, headers: noStoreHeaders }
    );
  }

  const { searchParams } = new URL(req.url);
  const parsed = z
    .object({
      lat: z.coerce.number().min(-90).max(90),
      lon: z.coerce.number().min(-180).max(180),
      date_iso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      datetime_iso: z.string().datetime({ offset: true }).optional(),
    })
    .safeParse({
      lat: searchParams.get("lat"),
      lon: searchParams.get("lon"),
      date_iso: searchParams.get("date_iso"),
      datetime_iso: searchParams.get("datetime_iso") ?? undefined,
    });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-params", detail: parsed.error.flatten() },
      { status: 400, headers: noStoreHeaders },
    );
  }
  const { lat, lon, date_iso, datetime_iso } = parsed.data;

  const url = new URL(`${rootUrl}/twilight/events`);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("date_iso", date_iso);
  if (datetime_iso) url.searchParams.set("datetime_iso", datetime_iso);

  const start = Date.now();
  try {
    const res = await fetchWithTimeout(
      url.toString(),
      { next: { revalidate: DEFAULT_TTL_SECONDS } },
      DEFAULT_TIMEOUT_MS,
    );
    const text = await res.text(); // read once, then JSON parse
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      console.error(
        JSON.stringify({
          level: "error",
          route: "/api/py-twilight",
          msg: "upstream-failed",
          status: res.status,
          latencyMs,
          url: url.toString(),
          body: text.slice(0, 500),
        }),
      );
      return NextResponse.json(
        {
          error: "py-twilight-failed",
          status: res.status,
          body: text.slice(0, 500),
        },
        { status: 502, headers: noStoreHeaders }
      );
    }
    return NextResponse.json(JSON.parse(text), { headers: cacheHeaders() });
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/py-twilight",
        msg: "upstream-exception",
        latencyMs,
        url: url.toString(),
        error: String(err?.message ?? err),
      }),
    );
    const status =
      String(err?.name ?? "").includes("AbortError") ||
      String(err?.message ?? "").includes("abort")
        ? 504
        : 502;
    return NextResponse.json(
      { error: "py-twilight-exception", detail: String(err?.message ?? err) },
      { status, headers: noStoreHeaders }
    );
  }
}
