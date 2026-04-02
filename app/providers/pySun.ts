// app/providers/pySun.ts
export type SunEvents = {
  sunriseLocal?: string | null;
  sunsetLocal?: string | null;
};

export async function fetchSunEvents(
  lat: number,
  lon: number,
  dateIso: string,
  baseUrl?: string,
): Promise<SunEvents> {
  const origin = resolveBaseUrl(baseUrl);
  if (!origin) throw new Error("missing-base-url");
  const url = new URL("/api/py-sun", origin);
  url.searchParams.set("date_iso", dateIso);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("py-sun-events-failed");
  return res.json();
}
import { resolveBaseUrl } from "../lib/baseUrl";
