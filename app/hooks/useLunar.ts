"use client";
import { useQuery } from "@tanstack/react-query";
import {
  lunarNowQueryOptions,
  moonTodayQueryOptions,
  type LunarNowResult,
  type MoonEventsResult,
} from "../queries/lunar";

export type { LunarNowResult, MoonEventsResult };

export function useLunarNow(lat: number, lon: number, tz: string) {
  return useQuery<LunarNowResult>(lunarNowQueryOptions({ lat, lon, tz }));
}

export function useMoonToday(lat: number, lon: number, tz: string) {
  return useQuery<MoonEventsResult>(moonTodayQueryOptions({ lat, lon, tz }));
}
