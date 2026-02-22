import { resolveBaseUrl } from "../lib/baseUrl";

export type WeatherCondition =
  | "clear"
  | "partly_cloudy"
  | "overcast"
  | "rain"
  | "snow"
  | "storm"
  | "fog";

export type WeatherNow = {
  condition: WeatherCondition;
  cloudCoverPct?: number;
  precipitationMm?: number;
  rainMm?: number;
  showersMm?: number;
  snowfallMm?: number;
  weatherCode?: number;
};

export async function fetchWeatherNow(
  lat: number,
  lon: number,
  baseUrl?: string,
): Promise<WeatherNow> {
  const origin = resolveBaseUrl(baseUrl);
  if (!origin) throw new Error("missing-base-url");

  const url = new URL("/api/weather/current", origin);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("weather-now-failed");
  return res.json();
}
