import { keepPreviousData } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { fetchMoonCard } from "../providers/mooncard";

export type LunarNowResult = {
  whenISO: string;
  internal: {
    altDeg: number | null;
    azDeg: number | null;
    illumPct: number | null;
    illumination: number | null;
    phaseAngleDeg: number | null;
    phaseName?: string | null;
  };
};

export type MoonEventsResult = {
  internal: {
    rise?: string | null;
    set?: string | null;
    highMoon?: string | null;
    lowMoon?: string | null;
    phaseName?: string | null;
    prevRise?: string | null;
    prevSet?: string | null;
  };
};

type LunarQueryArgs = {
  lat: number;
  lon: number;
  tz: string;
  baseUrl?: string;
};

export function lunarNowQueryOptions({
  lat,
  lon,
  tz,
  baseUrl,
}: LunarQueryArgs) {
  const enabled =
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    typeof tz === "string" &&
    tz.length > 0;

  return {
    queryKey: [
      "lunar-now",
      lat,
      lon,
      tz,
      formatInTimeZone(new Date(), tz, "yyyy-MM-dd"),
    ],
    enabled,
    queryFn: async (): Promise<LunarNowResult> => {
      const summary = await fetchMoonCard({
        lat,
        lon,
        tz,
        requestOrigin: "dashboard",
        baseUrl,
      });
      const moon = summary.moon;
      return {
        whenISO: summary.meta.timestamp_iso,
        internal: {
          altDeg: moon.altitude_deg,
          azDeg: moon.azimuth_deg,
          illumPct: moon.illumination_percent,
          illumination: moon.illumination_fraction,
          phaseAngleDeg: moon.phase_angle_deg,
          phaseName: moon.phase_name,
        },
      };
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  };
}

export function moonTodayQueryOptions({
  lat,
  lon,
  tz,
  baseUrl,
}: LunarQueryArgs) {
  const enabled =
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    typeof tz === "string" &&
    tz.length > 0;

  return {
    queryKey: [
      "moon-events",
      lat,
      lon,
      tz,
      formatInTimeZone(new Date(), tz, "yyyy-MM-dd"),
    ],
    enabled,
    queryFn: async (): Promise<MoonEventsResult> => {
      const summary = await fetchMoonCard({
        lat,
        lon,
        tz,
        requestOrigin: "dashboard",
        baseUrl,
      });
      return {
        internal: {
          rise: summary.moon.moonrise,
          set: summary.moon.moonset,
          highMoon: summary.moon.high_moon,
          lowMoon: summary.moon.low_moon,
          phaseName: summary.moon.phase_name,
          prevRise: null,
          prevSet: null,
        },
      };
    },
    staleTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  };
}
