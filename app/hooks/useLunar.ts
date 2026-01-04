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

    prevRise?: string;
    prevSet?: string;
  };
  external: {
    rise?: string;
    set?: string;
    highMoon?: string;
    lowMoon?: string;
    phaseName?: string;
    prevRise?: string;
    prevSet?: string;
  };
};

function shiftLocalDate(base: Date, tz: string, deltaDays: number): string {
  // Use noon so DST transitions at ~2AM don’t cause off-by-one local dates.
  const baseNoon = formatInTimeZone(base, tz, "yyyy-MM-dd'T'12:00:00XXX");
  const d = new Date(baseNoon);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return formatInTimeZone(d, tz, "yyyy-MM-dd");
}

function isPast(iso: string | undefined, now: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t <= now.getTime();
}

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
          phaseName: py.phase_name,
        },
        external: {
          altDeg: sc.altDeg,
          azDeg: sc.azDeg,
          illumPct: Math.round(sc.frac * 100),
          phaseName: py.phase_name,
        },
      };
    },
    // Refetch once per minute
    refetchInterval: 60_000,
  });
}

function approximateHighMoon(
  rise: string | undefined,
  set: string | undefined,
  tz: string
): string | undefined {
  if (!rise || !set) return undefined;
  const riseDate = new Date(rise);
  const setDate = new Date(set);
  if (
    !Number.isFinite(riseDate.getTime()) ||
    !Number.isFinite(setDate.getTime())
  )
    return undefined;
  // Midpoint timestamp between rise and set
  const midMillis =
    riseDate.getTime() + (setDate.getTime() - riseDate.getTime()) / 2;
  const midDate = new Date(midMillis);
  return formatInTimeZone(midDate, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/**
 * useMoonToday compares the daily lunar events (rise, set, high moon,
 * low moon) and phase names between the internal Python ephemeris and
 * the external MET Norway API. It returns an object containing both
 * sets of results. The query is considered fresh for thirty minutes.
 */

export function useMoonToday(lat: number, lon: number, tz: string) {
  return useQuery({
    queryKey: ["moon-today-compare", lat, lon, tz],
    queryFn: async () => {
      const now = new Date();

      const todayLocal = formatInTimeZone(now, tz, "yyyy-MM-dd");
      const yesterdayLocal = shiftLocalDate(now, tz, -1);
      const tomorrowLocal = shiftLocalDate(now, tz, +1);

      // Always fetch "today" first (we use its moonset to decide rollover)
      const [pyToday, extToday] = await Promise.all([
        fetchMoonEvents(lat, lon, todayLocal),
        fetchMoonToday({ lat, lon, tz, date: todayLocal }),
      ]);

      // Prefer external for rollover decision since todayLocal is based on tz
      const setForSwitch = extToday.set ?? pyToday.set;
      const moonsetPassed = isPast(setForSwitch, now);

      const activeDate = moonsetPassed ? tomorrowLocal : todayLocal;
      const previousDate = moonsetPassed ? todayLocal : yesterdayLocal;

      const [pyActive, pyPrev, extActive, extPrev] = await Promise.all([
        activeDate === todayLocal
          ? Promise.resolve(pyToday)
          : fetchMoonEvents(lat, lon, activeDate),
        previousDate === todayLocal
          ? Promise.resolve(pyToday)
          : fetchMoonEvents(lat, lon, previousDate),

        activeDate === todayLocal
          ? Promise.resolve(extToday)
          : fetchMoonToday({ lat, lon, tz, date: activeDate }),
        previousDate === todayLocal
          ? Promise.resolve(extToday)
          : fetchMoonToday({ lat, lon, tz, date: previousDate }),
      ]);

      const fallbackInternalHigh = approximateHighMoon(
        pyActive.rise,
        pyActive.set,
        tz
      );
      const fallbackExternalHigh = approximateHighMoon(
        extActive.rise,
        extActive.set,
        tz
      );

      return {
        internal: {
          rise: pyActive.rise,
          set: pyActive.set,
          // prefer the value from the Python service, but use the fallback if undefined
          highMoon:
            pyActive.high_moon ??
            (pyActive as any).highMoon ??
            fallbackInternalHigh,
          lowMoon: pyActive.low_moon ?? (pyActive as any).lowMoon,
          phaseName: pyActive.phase_name ?? (pyActive as any).phaseName,
          prevRise: pyPrev.rise,
          prevSet: pyPrev.set,
        },
        external: {
          rise: extActive.rise,
          set: extActive.set,
          // prefer the value from MET, but use the fallback if undefined
          highMoon: (extActive as any).highMoon ?? fallbackExternalHigh,
          lowMoon: (extActive as any).lowMoon,
          phaseName: phaseNameFromDeg((extActive as any).phaseDeg),
          prevRise: extPrev.rise,
          prevSet: extPrev.set,
        },
      };
    },
    staleTime: 60_000 * 30,
  });
}
