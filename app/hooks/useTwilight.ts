"use client";

import { useQuery } from "@tanstack/react-query";
import { astronomySummaryQueryOptions } from "../queries/astronomy";
import type { TwilightData } from "../queries/twilight";

export type { TwilightData };

export function useTwilight(lat: number, lon: number, tz: string) {
  return useQuery({
    ...astronomySummaryQueryOptions({ lat, lon, tz }),
    select: (summary): TwilightData => ({
      timezoneOffset: summary.twilight.timezone_offset,
      currentPhase: summary.twilight.current_phase,
      nextTransitionLocal: summary.twilight.next_transition_local,
      segments: summary.twilight.segments.map((segment) => ({
        phase: segment.phase,
        startLocal: segment.start_local,
        endLocal: segment.end_local,
      })),
      sunEvents: {
        sunriseLocal: summary.twilight.sun_events.sunrise_local,
        sunsetLocal: summary.twilight.sun_events.sunset_local,
      },
    }),
  });
}
