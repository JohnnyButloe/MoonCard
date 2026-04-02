// Open-Meteo Geocoding search (no key)
export type Place = {
  name: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  country?: string;
  region?: string;
};

type OpenMeteoGeocodeResult = {
  name: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  country?: string;
  admin1?: string;
};

type OpenMeteoGeocodeResponse = {
  results?: OpenMeteoGeocodeResult[];
};

export async function searchPlaces(
  q: string,
  count = 5,
  signal?: AbortSignal,
): Promise<Place[]> {
  if (!q || q.trim().length < 2) return [];

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", q);
  url.searchParams.set("count", String(count));
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), {
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error("geocode-failed");

  const json = (await res.json()) as OpenMeteoGeocodeResponse;
  return (json.results ?? []).map((result) => ({
    name: result.name,
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone,
    country: result.country,
    region: result.admin1,
  }));
}
