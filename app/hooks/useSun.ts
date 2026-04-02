"use client";

import { useQuery } from "@tanstack/react-query";
import { astronomySummaryQueryOptions } from "../queries/astronomy";
import type { SunEvents } from "../queries/sun";

export type { SunEvents };

export function useSunToday(lat: number, lon: number, tz: string) {
  return useQuery({
    ...astronomySummaryQueryOptions({ lat, lon, tz }),
    select: (summary): SunEvents => ({
      sunriseLocal: summary.sun.events.sunrise_local,
      sunsetLocal: summary.sun.events.sunset_local,
    }),
  });
}
