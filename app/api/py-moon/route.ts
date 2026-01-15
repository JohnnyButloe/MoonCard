// app/api/py-moon/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") ?? "now"; // "now" or "events"
  const url = new URL(`${process.env.NEXT_PUBLIC_PY_MOON_API}/${mode}`);

  // copy lat, lon, datetime_iso/date_iso, elev from query params
  searchParams.forEach((value, key) => {
    if (["datetime_iso", "date_iso", "lat", "lon"].includes(key)) {
      url.searchParams.set(key, value);
    }
  });

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ error: "py-moon-failed" }, { status: 502 });
  }
  const data = await res.json();
  return NextResponse.json(data);
}
