"use client";

import { useQuery } from "@tanstack/react-query";
import { weatherNowQueryOptions, type WeatherNow } from "../queries/weather";

export type { WeatherNow };

export function useWeatherNow(lat: number, lon: number) {
  return useQuery<WeatherNow>(weatherNowQueryOptions({ lat, lon }));
}
