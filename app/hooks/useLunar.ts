"use client";
import { useQuery } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { getMoonNow } from "../lib/suncalc";
import { fetchMoonToday, phaseNameFromDeg } from "../providers/metno";

export function useLunarNow(lat: number, lon: number, tz: string) {
  // recompute every minute for “now”
  return useQuery({
    queryKey: ["moon-now", lat, lon, tz],
    queryFn: async () => {
      const now = new Date();
      const pos = getMoonNow(lat, lon, now);
      const whenISO = formatInTimeZone(now, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
      return {
        whenISO,
        altDeg: pos.altDeg,
        azDeg: pos.azDeg,
        illumPct: Math.round(pos.frac * 100),
        phaseName: undefined as string | undefined,
      };
    },
    refetchInterval: 60_000,
  });
}

export function useMoonToday(lat: number, lon: number, tz: string) {
  return useQuery({
    queryKey: ["moon-today", lat, lon, tz],
    queryFn: async () => {
      const todayLocal = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
      const evt = await fetchMoonToday({ lat, lon, tz, date: todayLocal });
      return {
        ...evt,
        phaseName: phaseNameFromDeg(evt.phaseDeg),
      };
    },
    staleTime: 60_000 * 30, // 30 min
  });
}
