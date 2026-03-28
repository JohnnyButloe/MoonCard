// app/api/py-moon/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  cacheHeaders,
  fetchWithTimeout,
  noStoreHeaders,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_TTL_SECONDS,
} from "../../lib/apiUtils";

const Q = z.object({
  mode: z.enum(["now", "events"]).optional().default("now"),
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  datetime_iso: z.string().datetime({ offset: true }).optional(),
  date_iso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tz: z.string().min(1).max(100).optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = Q.safeParse({
    mode: searchParams.get("mode") ?? undefined,
    lat: searchParams.get("lat"),
    lon: searchParams.get("lon"),
    datetime_iso: searchParams.get("datetime_iso") ?? undefined,
    date_iso: searchParams.get("date_iso") ?? undefined,
    tz: searchParams.get("tz") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-params", detail: parsed.error.flatten() },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const { mode, lat, lon, datetime_iso, date_iso, tz } = parsed.data;
  if (mode === "now" && !datetime_iso) {
    return NextResponse.json(
      { error: "missing datetime_iso" },
      { status: 400, headers: noStoreHeaders },
    );
  }
  if (mode === "events" && !date_iso) {
    return NextResponse.json(
      { error: "missing date_iso" },
      { status: 400, headers: noStoreHeaders },
    );
  }
  if (mode === "events" && !tz) {
    return NextResponse.json(
      { error: "missing tz" },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const baseUrl = process.env.PY_MOON_API;
  if (!baseUrl) {
    return NextResponse.json(
      { error: "missing PY_MOON_API" },
      { status: 500, headers: noStoreHeaders },
    );
  }
  const url = new URL(`${baseUrl}/${mode}`);

  // copy lat, lon, datetime_iso/date_iso, elev from query params
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  if (datetime_iso) url.searchParams.set("datetime_iso", datetime_iso);
  if (date_iso) url.searchParams.set("date_iso", date_iso);
  if (tz) url.searchParams.set("tz", tz);

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
          route: "/api/py-moon",
          msg: "upstream-failed",
          status: res.status,
          latencyMs,
          url: url.toString(),
          body: text.slice(0, 500),
        }),
      );
      return NextResponse.json(
        { error: "py-moon-failed", status: res.status },
        { status: 502, headers: noStoreHeaders },
      );
    }
    const data = JSON.parse(text);
    return NextResponse.json(data, { headers: cacheHeaders() });
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const errName = err instanceof Error ? err.name : "";
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/py-moon",
        msg: "upstream-exception",
        latencyMs,
        url: url.toString(),
        error: errMessage,
      }),
    );
    const status =
      errName.includes("AbortError") || errMessage.includes("abort")
        ? 504
        : 502;
    return NextResponse.json(
      { error: "py-moon-exception" },
      { status, headers: noStoreHeaders },
    );
  }
}
