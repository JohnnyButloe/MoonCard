// app/hooks/useSun.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import {
  fetchSunEvents,
  fetchSunNow,
  SunEvents,
  SunNow,
} from "../providers/pySun";

export function useSunNow(lat: number, lon: number, tz: string) {
  return useQuery<SunNow>({
    queryKey: ["sun-now", lat, lon, tz],
    queryFn: async () => {
      const now = new Date();
      const isoUtc = now.toISOString();
      return fetchSunNow(lat, lon, isoUtc);
    },
    refetchInterval: 60_000,
  });
}

export function useSunToday(lat: number, lon: number, tz: string) {
  return useQuery<SunEvents>({
    queryKey: ["sun-today", lat, lon, tz],
    queryFn: async () => {
      const now = new Date();
      const dateIso = formatInTimeZone(now, tz, "yyyy-MM-dd");
      return fetchSunEvents(lat, lon, dateIso);
    },
    refetchInterval: 30 * 60 * 1000,
  });
}
