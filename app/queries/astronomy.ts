import { keepPreviousData } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import {
  fetchAstronomySummary,
  fetchMoonPhaseWindow,
  type AstronomySummary,
  type MoonPhaseWindow,
} from "../providers/pyAstronomy";

export function astronomySummaryQueryOptions({
  lat,
  lon,
  tz,
  baseUrl,
}: {
  lat: number;
  lon: number;
  tz: string;
  baseUrl?: string;
}) {
  const enabled =
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    typeof tz === "string" &&
    tz.length > 0;

  return {
    queryKey: [
      "astronomy-summary",
      lat,
      lon,
      tz,
      formatInTimeZone(new Date(), tz, "yyyy-MM-dd"),
    ],
    enabled,
    queryFn: async (): Promise<AstronomySummary> => {
      const now = new Date();
      return fetchAstronomySummary(lat, lon, tz, now.toISOString(), baseUrl);
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  };
}

export function moonPhaseWindowQueryOptions({
  tz,
  startDateIso,
  windowDays,
  baseUrl,
}: {
  tz: string;
  startDateIso: string;
  windowDays: number;
  baseUrl?: string;
}) {
  const enabled =
    typeof tz === "string" &&
    tz.length > 0 &&
    typeof startDateIso === "string" &&
    startDateIso.length > 0 &&
    Number.isFinite(windowDays);

  return {
    queryKey: ["astronomy-phases", tz, startDateIso, windowDays],
    enabled,
    queryFn: async (): Promise<MoonPhaseWindow> =>
      fetchMoonPhaseWindow(tz, startDateIso, windowDays, baseUrl),
    staleTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  };
}

export type { AstronomySummary, MoonPhaseWindow };
