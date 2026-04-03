"use client";

import { useQuery } from "@tanstack/react-query";
import { moonCardQueryOptions } from "../queries/mooncard";
import type { SunEvents } from "../queries/sun";

export type { SunEvents };

export function useSunToday(lat: number, lon: number, tz: string) {
  return useQuery({
    ...moonCardQueryOptions({ lat, lon, tz, requestOrigin: "dashboard" }),
    select: (summary): SunEvents => ({
      sunriseLocal: summary.sun.sunrise,
      sunsetLocal: summary.sun.sunset,
    }),
  });
}
