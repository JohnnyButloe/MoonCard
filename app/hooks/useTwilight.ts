// app/hooks/useTwilight.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { fetchTwilight, TwilightData } from "../providers/pyTwilight";

/**
 * useTwilight fetches twilight segments for the given lat/lon/timezone.
 * It computes the local date using the provided TZ and passes the current UTC
 * time to the API so the backend can compute `currentPhase` and `nextTransitionLocal`.
 */
export function useTwilight(lat: number, lon: number, tz: string) {
  return useQuery<TwilightData>({
    queryKey: ["twilight", lat, lon, tz],
    queryFn: async () => {
      const now = new Date();
      const dateIso = formatInTimeZone(now, tz, "yyyy-MM-dd");
      const isoUtc = now.toISOString();
      return fetchTwilight(lat, lon, dateIso, isoUtc);
    },
    // Twilight phases change slowly; refresh every 10 minutes.
    refetchInterval: 10 * 60 * 1000,
  });
}
