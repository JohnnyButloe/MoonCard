// Open-Meteo Geocoding search (no key)
export type Place = {
  name: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  country?: string;
};

export async function searchPlaces(q: string, count = 5): Promise<Place[]> {
  if (!q || q.trim().length < 2) return [];
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", q);
  url.searchParams.set("count", String(count));
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("geocode-failed");
  const json = await res.json();
  return (json.results ?? []).map((r: any) => ({
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
    country: r.country,
  }));
}
