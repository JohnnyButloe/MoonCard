// app/providers/pyMoon.ts
export type MoonNow = {
  alt_deg: number;
  az_deg: number;
  illum_frac: number;
  phase_angle: number;
  distance_km: number;
  ra_hours: number;
  dec_deg: number;
};

export type MoonEvents = {
  rise?: string;
  set?: string;
  high_moon?: string;
  low_moon?: string;
  phase_name?: string;
};

export async function fetchMoonNow(
  lat: number,
  lon: number,
  dateTimeIso: string
): Promise<MoonNow> {
  const url = new URL("/api/py-moon", location.origin);
  url.searchParams.set("mode", "now");
  url.searchParams.set("datetime_iso", dateTimeIso);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("py-moon-now-failed");
  return res.json();
}

export async function fetchMoonEvents(
  lat: number,
  lon: number,
  dateIso: string
): Promise<MoonEvents> {
  const url = new URL("/api/py-moon", location.origin);
  url.searchParams.set("mode", "events");
  url.searchParams.set("date_iso", dateIso);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("py-moon-events-failed");
  return res.json();
}
