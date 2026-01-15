// app/api/py-twilight/route.ts
import { NextRequest, NextResponse } from "next/server";

function getPyRootUrl(): string | null {
  const baseUrl = process.env.NEXT_PUBLIC_PY_MOON_API;
  if (!baseUrl) return null;

  // If your env is ".../moon" (common), strip it so we can call "/twilight/events"
  return baseUrl.replace(/\/moon\/?$/, "");
}

export async function GET(req: NextRequest) {
  const rootUrl = getPyRootUrl();
  if (!rootUrl) {
    return NextResponse.json(
      { error: "missing NEXT_PUBLIC_PY_MOON_API" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);

  const url = new URL(`${rootUrl}/twilight/events`);
  for (const key of ["datetime_iso", "date_iso", "lat", "lon"]) {
    const val = searchParams.get(key);
    if (val) url.searchParams.set(key, val);
  }

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    const text = await res.text(); // read once, then JSON parse
    if (!res.ok) {
      return NextResponse.json(
        {
          error: "py-twilight-failed",
          status: res.status,
          body: text.slice(0, 500),
        },
        { status: 502 }
      );
    }
    return NextResponse.json(JSON.parse(text));
  } catch (err: any) {
    return NextResponse.json(
      { error: "py-twilight-exception", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
