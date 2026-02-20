// app/hooks/useSun.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { sunEventsQueryOptions, type SunEvents } from "../queries/sun";

export type { SunEvents };

export function useSunToday(lat: number, lon: number, tz: string) {
  return useQuery<SunEvents>(sunEventsQueryOptions({ lat, lon, tz }));
}
