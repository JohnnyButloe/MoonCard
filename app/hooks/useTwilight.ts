// app/hooks/useTwilight.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { twilightQueryOptions, type TwilightData } from "../queries/twilight";

export type { TwilightData };

/**
 * useTwilight fetches twilight segments for the given lat/lon/timezone.
 * It computes the local date using the provided TZ and passes the current UTC
 * time to the API so the backend can compute `currentPhase` and `nextTransitionLocal`.
 */
export function useTwilight(lat: number, lon: number, tz: string) {
  return useQuery<TwilightData>(twilightQueryOptions({ lat, lon, tz }));
}
