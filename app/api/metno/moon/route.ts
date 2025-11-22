import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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
    return NextResponse.json;
  }
  const { lat, lon, date, offset } = parsed.data;

  const upstream = new URL("https://api.met.no/weatherapi/sunrise/3.0/moon");
  upstream.searchParams.set("lat", String(lat));
  upstream.searchParams.set("lon", String(lon));
  upstream.searchParams.set("date", date);
  upstream.searchParams.set("offset", offset);

  const res = await fetch(upstream, {
    headers: {
      // Identify app per MET's TOS/FAQ Policy
      // Include project name and a contract email.
      "User-Agent": "MoonCard (support@mooncard.app",
    },
    // no-store to avoid mixing locations while developing; can tune later
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ error: "metno-failed" }, { status: 502 });
  }
  const json = await res.json();
  return NextResponse.json(json);
}
