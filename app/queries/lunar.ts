import { keepPreviousData } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { fetchAstronomySummary } from "../providers/pyAstronomy";

export type LunarNowResult = {
  whenISO: string;
  internal: {
    altDeg: number;
    azDeg: number;
    illumPct: number;
    illumination: number;
    waxing: boolean;
    phaseAngleDeg: number;
    brightLimbAngleDeg: number;
    phaseName?: string | null;
    tiltDeg?: number;
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
      const summary = await fetchAstronomySummary(
        lat,
        lon,
        tz,
        new Date().toISOString(),
        baseUrl,
      );
      const moon = summary.moon.current;
      return {
        whenISO: summary.meta.date.current_local,
        internal: {
          altDeg: moon.altitude_deg,
          azDeg: moon.azimuth_deg,
          illumPct: moon.illumination_pct,
          illumination: moon.illumination_frac,
          waxing: moon.waxing,
          phaseAngleDeg: moon.phase_angle_deg,
          brightLimbAngleDeg: moon.bright_limb_angle_deg,
          phaseName: moon.phase_name,
          tiltDeg: moon.bright_limb_angle_deg - 270,
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
      const summary = await fetchAstronomySummary(
        lat,
        lon,
        tz,
        new Date().toISOString(),
        baseUrl,
      );
      return {
        internal: {
          rise: summary.moon.events.rise_local,
          set: summary.moon.events.set_local,
          highMoon: summary.moon.events.high_moon_local,
          lowMoon: summary.moon.events.low_moon_local,
          phaseName: summary.moon.current.phase_name,
          prevRise: summary.moon.events.previous_rise_local,
          prevSet: summary.moon.events.previous_set_local,
        },
      };
    },
    staleTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  };
}
