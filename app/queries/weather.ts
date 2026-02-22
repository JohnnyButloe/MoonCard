import { keepPreviousData } from "@tanstack/react-query";
import { fetchWeatherNow, type WeatherNow } from "../providers/weather";

export function weatherNowQueryOptions({
  lat,
  lon,
  baseUrl,
}: {
  lat: number;
  lon: number;
  baseUrl?: string;
}) {
  return {
    queryKey: ["weather-now", lat, lon],
    queryFn: async () => fetchWeatherNow(lat, lon, baseUrl),
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  };
}

export type { WeatherNow };
