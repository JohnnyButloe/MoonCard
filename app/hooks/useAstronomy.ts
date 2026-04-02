"use client";

import { useQuery } from "@tanstack/react-query";
import {
  astronomySummaryQueryOptions,
  moonPhaseWindowQueryOptions,
  type AstronomySummary,
  type MoonPhaseWindow,
} from "../queries/astronomy";

export type { AstronomySummary, MoonPhaseWindow };

export function useAstronomySummary(lat: number, lon: number, tz: string) {
  return useQuery<AstronomySummary>(astronomySummaryQueryOptions({ lat, lon, tz }));
}

export function useMoonPhaseWindow(
  tz: string,
  startDateIso: string,
  windowDays: number,
) {
  return useQuery<MoonPhaseWindow>(
    moonPhaseWindowQueryOptions({ tz, startDateIso, windowDays }),
  );
}
