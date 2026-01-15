// app/providers/pyTwilight.ts
export interface TwilightSegment {
  phase: string;
  startLocal: string;
  endLocal: string;
}

export interface TwilightData {
  timezoneOffset?: string;
  currentPhase: string;
  nextTransitionLocal?: string | null;
  segments: TwilightSegment[];
}

/**
 * Fetch twilight segments from the Next.js proxy (/api/py-twilight).
 *
 * @param lat Latitude in degrees
 * @param lon Longitude in degrees
 * @param dateIso Local date as YYYY-MM-DD (same convention as moon events)
 * @param datetimeIso Optional ISO datetime (UTC) used to compute currentPhase
 */
export async function fetchTwilight(
  lat: number,
  lon: number,
  dateIso: string,
  datetimeIso?: string
): Promise<TwilightData> {
  const url = new URL("/api/py-twilight", location.origin);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("date_iso", dateIso);
  if (datetimeIso) {
    url.searchParams.set("datetime_iso", datetimeIso);
  }
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("py-twilight-failed");
  return res.json();
}
