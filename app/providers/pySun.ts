// app/providers/pySun.ts
export type SunNow = {
  alt_deg: number;
  az_deg: number;
};

export type SunEvents = {
  sunriseLocal?: string | null;
  sunsetLocal?: string | null;
};

export async function fetchSunNow(
  lat: number,
  lon: number,
  dateTimeIso: string,
): Promise<SunNow> {
  const url = new URL("/api/py-sun", location.origin);
  url.searchParams.set("mode", "now");
  url.searchParams.set("datetime_iso", dateTimeIso);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("py-sun-now-failed");
  return res.json();
}

export async function fetchSunEvents(
  lat: number,
  lon: number,
  dateIso: string,
): Promise<SunEvents> {
  const url = new URL("/api/py-sun", location.origin);
  url.searchParams.set("mode", "events");
  url.searchParams.set("date_iso", dateIso);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("py-sun-events-failed");
  return res.json();
}
