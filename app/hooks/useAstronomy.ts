"use client";

import { useQuery } from "@tanstack/react-query";
import {
  moonPhaseWindowQueryOptions,
  type MoonPhaseWindow,
} from "../queries/astronomy";
import {
  moonCardQueryOptions,
  type MoonCardResponse,
} from "../queries/mooncard";

export type { MoonCardResponse, MoonPhaseWindow };

export function useMoonCard(
  lat: number,
  lon: number,
  tz: string,
  options?: {
    label?: string | null;
  },
) {
  return useQuery<MoonCardResponse>(
    moonCardQueryOptions({
      lat,
      lon,
      tz,
      label: options?.label ?? null,
      requestOrigin: "dashboard",
    }),
  );
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

export const useAstronomySummary = useMoonCard;
