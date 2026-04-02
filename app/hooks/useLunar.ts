"use client";

import { useQuery } from "@tanstack/react-query";
import { astronomySummaryQueryOptions } from "../queries/astronomy";
import type { LunarNowResult, MoonEventsResult } from "../queries/lunar";

export type { LunarNowResult, MoonEventsResult };

export function useLunarNow(lat: number, lon: number, tz: string) {
  return useQuery({
    ...astronomySummaryQueryOptions({ lat, lon, tz }),
    select: (summary): LunarNowResult => ({
      whenISO: summary.meta.date.current_local,
      internal: {
        altDeg: summary.moon.current.altitude_deg,
        azDeg: summary.moon.current.azimuth_deg,
        illumPct: summary.moon.current.illumination_pct,
        illumination: summary.moon.current.illumination_frac,
        waxing: summary.moon.current.waxing,
        phaseAngleDeg: summary.moon.current.phase_angle_deg,
        brightLimbAngleDeg: summary.moon.current.bright_limb_angle_deg,
        phaseName: summary.moon.current.phase_name,
        tiltDeg: summary.moon.current.bright_limb_angle_deg - 270,
      },
    }),
  });
}

export function useMoonToday(lat: number, lon: number, tz: string) {
  return useQuery({
    ...astronomySummaryQueryOptions({ lat, lon, tz }),
    select: (summary): MoonEventsResult => ({
      internal: {
        rise: summary.moon.events.rise_local,
        set: summary.moon.events.set_local,
        highMoon: summary.moon.events.high_moon_local,
        lowMoon: summary.moon.events.low_moon_local,
        phaseName: summary.moon.current.phase_name,
        prevRise: summary.moon.events.previous_rise_local,
        prevSet: summary.moon.events.previous_set_local,
      },
    }),
  });
}
