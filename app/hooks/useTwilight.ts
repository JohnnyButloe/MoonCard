"use client";

import { useQuery } from "@tanstack/react-query";
import { moonCardQueryOptions } from "../queries/mooncard";
import type { TwilightData } from "../queries/twilight";

export type { TwilightData };

export function useTwilight(lat: number, lon: number, tz: string) {
  return useQuery({
    ...moonCardQueryOptions({ lat, lon, tz, requestOrigin: "dashboard" }),
    select: (summary): TwilightData => ({
      currentPhase: summary.twilight.current_phase,
      nextTransitionLocal: summary.twilight.next_transition,
      segments: summary.twilight.segments.map((segment) => ({
        phase: segment.phase,
        startLocal: segment.start,
        endLocal: segment.end,
      })),
      sunEvents: {
        sunriseLocal: summary.sun.sunrise,
        sunsetLocal: summary.sun.sunset,
      },
    }),
  });
}
