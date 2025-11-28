"use client";
import { useQuery } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";

// External providers: SunCalc and MET Norway API
import { getMoonNow } from "../lib/suncalc";
import { fetchMoonToday, phaseNameFromDeg } from "../providers/metno";

// Internal providers: our Python ephemeris service
import { fetchMoonNow, fetchMoonEvents } from "../providers/pyMoon";

/**
 * A result type representing the current Moon position and illumination
 * from both the internal Python ephemeris service and the external
 * SunCalc library. The `whenISO` field reflects the current local
 * timestamp formatted in the provided timezone.
 */
export type LunarNowResult = {
  /**
   * Local time formatted as ISO 8601 in the user's timezone. This is
   * primarily used for display purposes on the UI.
   */
  whenISO: string;
  /** Data computed by the internal Python ephemeris service. */
  internal: {
    altDeg: number;
    azDeg: number;
    illumPct: number;
    phaseName?: string;
  };
  /** Data computed by the external SunCalc/MET providers. */
  external: {
    altDeg: number;
    azDeg: number;
    illumPct: number;
    phaseName?: string;
  };
};

/**
 * A result type representing the lunar rise, set and culmination times
 * for the given date. It contains both internal and external results.
 */
export type LunarTodayResult = {
  internal: {
    rise?: string;
    set?: string;
    highMoon?: string;
    lowMoon?: string;
    phaseName?: string;
  };
  external: {
    rise?: string;
    set?: string;
    highMoon?: string;
    lowMoon?: string;
    phaseName?: string;
  };
};

/**
 * useLunarNow performs a live comparison between the internal Python
 * ephemeris (via `fetchMoonNow`) and the existing SunCalc implementation.
 * It returns both results in a single object along with the formatted
 * local timestamp. This hook refetches every minute to keep the data up
 * to date.
 */
export function useLunarNow(lat: number, lon: number, tz: string) {
  return useQuery<LunarNowResult>({
    queryKey: ["moon-now-compare", lat, lon, tz],
    queryFn: async () => {
      const now = new Date();
      // Format the local timestamp for display using the provided timezone.
      const whenISO = formatInTimeZone(now, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
      // Use the ISO string in UTC for the internal API call.
      const isoUtc = now.toISOString();

      // Internal calculation via Python service
      const py = await fetchMoonNow(lat, lon, isoUtc);
      // External calculation via SunCalc
      const sc = getMoonNow(lat, lon, now);

      return {
        whenISO,
        internal: {
          altDeg: py.alt_deg,
          azDeg: py.az_deg,
          illumPct: Math.round(py.illum_frac * 100),
          phaseName: undefined,
        },
        external: {
          altDeg: sc.altDeg,
          azDeg: sc.azDeg,
          illumPct: Math.round(sc.frac * 100),
          phaseName: undefined,
        },
      };
    },
    // Refetch once per minute
    refetchInterval: 60_000,
  });
}

/**
 * useMoonToday compares the daily lunar events (rise, set, high moon,
 * low moon) and phase names between the internal Python ephemeris and
 * the external MET Norway API. It returns an object containing both
 * sets of results. The query is considered fresh for thirty minutes.
 */
export function useMoonToday(lat: number, lon: number, tz: string) {
  return useQuery<LunarTodayResult>({
    queryKey: ["moon-today-compare", lat, lon, tz],
    queryFn: async () => {
      // Compute the local date string in the user's timezone (YYYY-MM-DD)
      const todayLocal = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
      // Internal daily events
      const pyEvt = await fetchMoonEvents(lat, lon, todayLocal);
      // External daily events from MET API
      const extEvt = await fetchMoonToday({ lat, lon, tz, date: todayLocal });

      return {
        internal: {
          rise: pyEvt.rise,
          set: pyEvt.set,
          highMoon: pyEvt.high_moon ?? (pyEvt as any).highMoon,
          lowMoon: pyEvt.low_moon ?? (pyEvt as any).lowMoon,
          phaseName: pyEvt.phase_name ?? (pyEvt as any).phaseName,
        },
        external: {
          rise: extEvt.rise,
          set: extEvt.set,
          highMoon: (extEvt as any).highMoon,
          lowMoon: (extEvt as any).lowMoon,
          phaseName: phaseNameFromDeg((extEvt as any).phaseDeg),
        },
      };
    },
    // Keep results for 30 minutes
    staleTime: 60_000 * 30,
  });
}
