"use client";

import { useQuery } from "@tanstack/react-query";
import { moonCardQueryOptions } from "../queries/mooncard";
import type { LunarNowResult, MoonEventsResult } from "../queries/lunar";

export type { LunarNowResult, MoonEventsResult };

export function useLunarNow(lat: number, lon: number, tz: string) {
  return useQuery({
    ...moonCardQueryOptions({ lat, lon, tz, requestOrigin: "dashboard" }),
    select: (summary): LunarNowResult => ({
      whenISO: summary.meta.timestamp_iso,
      internal: {
        altDeg: summary.moon.altitude_deg,
        azDeg: summary.moon.azimuth_deg,
        illumPct: summary.moon.illumination_percent,
        illumination: summary.moon.illumination_fraction,
        phaseAngleDeg: summary.moon.phase_angle_deg,
        phaseName: summary.moon.phase_name,
      },
    }),
  });
}

export function useMoonToday(lat: number, lon: number, tz: string) {
  return useQuery({
    ...moonCardQueryOptions({ lat, lon, tz, requestOrigin: "dashboard" }),
    select: (summary): MoonEventsResult => ({
      internal: {
        rise: summary.moon.moonrise,
        set: summary.moon.moonset,
        highMoon: summary.moon.high_moon,
        lowMoon: summary.moon.low_moon,
        phaseName: summary.moon.phase_name,
        prevRise: null,
        prevSet: null,
      },
    }),
  });
}
