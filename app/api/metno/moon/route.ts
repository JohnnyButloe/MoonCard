import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  cacheHeaders,
  fetchWithTimeout,
  noStoreHeaders,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_TTL_SECONDS,
} from "../../../lib/apiUtils";

const Q = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  offset: z.string().regex(/^[+-]\d{2}:\d{2}$/),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = Q.safeParse({
    lat: searchParams.get("lat"),
    lon: searchParams.get("lon"),
    date: searchParams.get("date"),
    offset: searchParams.get("offset") ?? "+00:00",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-params", detail: parsed.error.flatten() },
      { status: 400, headers: noStoreHeaders },
    );
  }
  const { lat, lon, date, offset } = parsed.data;

  const upstream = new URL("https://api.met.no/weatherapi/sunrise/3.0/moon");
  upstream.searchParams.set("lat", String(lat));
  upstream.searchParams.set("lon", String(lon));
  upstream.searchParams.set("date", date);
  upstream.searchParams.set("offset", offset);

  const start = Date.now();
  try {
    const res = await fetchWithTimeout(
      upstream.toString(),
      {
        headers: {
          // Identify app per MET's TOS/FAQ Policy
          // Include project name and a contract email.
          "User-Agent": "MoonCard (support@mooncard.app",
        },
        next: { revalidate: DEFAULT_TTL_SECONDS },
      },
      DEFAULT_TIMEOUT_MS,
    );

    const text = await res.text();
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      console.error(
        JSON.stringify({
          level: "error",
          route: "/api/metno/moon",
          msg: "upstream-failed",
          status: res.status,
          latencyMs,
          url: upstream.toString(),
          body: text.slice(0, 500),
        }),
      );
      return NextResponse.json(
        { error: "metno-failed", status: res.status },
        { status: 502, headers: noStoreHeaders },
      );
    }
    return NextResponse.json(JSON.parse(text), { headers: cacheHeaders() });
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/metno/moon",
        msg: "upstream-exception",
        latencyMs,
        url: upstream.toString(),
        error: String(err?.message ?? err),
      }),
    );
    const status =
      String(err?.name ?? "").includes("AbortError") ||
      String(err?.message ?? "").includes("abort")
        ? 504
        : 502;
    return NextResponse.json(
      { error: "metno-exception" },
      { status, headers: noStoreHeaders },
    );
  }
}
