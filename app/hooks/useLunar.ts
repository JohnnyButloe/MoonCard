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
 * SunCalc library. The `whenISO` field reflects the timestamp used
 * for the calculation.
 */
export type LunarNowResult = {
  whenISO: string;
  /** Data computed by the internal Python ephemeris service. */
  internal: {
    altDeg: number;
    azDeg: number;
    illumPct: number;
    phaseName?: string;
  };
  /** Data computed via the external SunCalc library. */
  external: {
    altDeg: number;
    azDeg: number;
    illumPct: number;
    phaseName?: string;
  };
};

export type MoonEventsResult = {
  /** Internal (Python service) event times. */
  internal: {
    rise?: string;
    set?: string;
    highMoon?: string;
    lowMoon?: string;
    phaseName?: string;
    prevRise?: string;
    prevSet?: string;
  };
  /** External (MET Norway) event times. */
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

function parseIso(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

function isPast(iso: string | undefined, now: Date): boolean {
  const t = parseIso(iso);
  return t !== null && t <= now.getTime();
}

function pickLatestBeforeIso(
  candidates: Array<string | undefined>,
  now: Date,
): string | undefined {
  const nowT = now.getTime();
  let bestT = -Infinity;
  let bestIso: string | undefined;
  for (const iso of candidates) {
    const t = parseIso(iso);
    if (t === null) continue;
    if (t <= nowT && t > bestT) {
      bestT = t;
      bestIso = iso;
    }
  }
  return bestIso;
}

function pickEarliestAfterIso(
  candidates: Array<string | undefined>,
  now: Date,
): string | undefined {
  const nowT = now.getTime();
  let bestT = Infinity;
  let bestIso: string | undefined;
  for (const iso of candidates) {
    const t = parseIso(iso);
    if (t === null) continue;
    if (t >= nowT && t < bestT) {
      bestT = t;
      bestIso = iso;
    }
  }
  return bestIso;
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
    queryKey: ["lunar-now-compare", lat, lon, tz],
    queryFn: async () => {
      const now = new Date();
      const whenISO = formatInTimeZone(now, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");

      // Convert to UTC ISO for the Python service
      const isoUtc = now.toISOString();

      // Internal (Python) calculation
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
    // Refresh every minute
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/**
 * Approximate a “high moon” time when the provider doesn’t return one.
 * This is a simple midpoint of the above-horizon window.
 */
function approximateHighMoon(riseISO?: string, setISO?: string, tz?: string) {
  if (!riseISO || !setISO) return undefined;
  const riseT = parseIso(riseISO);
  const setT = parseIso(setISO);
  if (riseT === null || setT === null) return undefined;
  const mid = new Date(riseT + (setT - riseT) / 2);
  return tz
    ? formatInTimeZone(mid, tz, "yyyy-MM-dd'T'HH:mm:ssXXX")
    : mid.toISOString();
}

/**
 * useMoonToday fetches moon rise/set/high/low event times for the current
 * local date (in the user's timezone) from both the internal Python service and
 * the external MET Norway API. It returns an object containing both
 * sets of results. The query is considered fresh for thirty minutes.
 *
 * ✅ Goal behavior implemented:
 * - If moon is UP (alt > 0): show most recent moonrise, and next moonset.
 * - If moon is DOWN (alt < 0): show next moonrise, and most recent moonset.
 */
export function useMoonToday(lat: number, lon: number, tz: string) {
  return useQuery<MoonEventsResult>({
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

      // Determine if the Moon is currently above the horizon (altitude > 0°).
      // We use the existing SunCalc helper here to avoid additional network calls.
      const scNow = getMoonNow(lat, lon, now);
      const moonIsUp = scNow.altDeg > 0;

      // Only roll over to tomorrow once today's moonset has passed AND the moon is down.
      // - If the moon is up: show the rise that already happened and the set that will happen.
      // - If the moon is down: show the next upcoming rise.
      const activeDate =
        moonsetPassed && !moonIsUp ? tomorrowLocal : todayLocal;
      const previousDate =
        activeDate === todayLocal ? yesterdayLocal : todayLocal;

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

      // If activeDate is today, the “next” date is tomorrow.
      // If activeDate is tomorrow, the “next” date is the day after tomorrow.
      const dayAfterTomorrowLocal = shiftLocalDate(now, tz, +2);
      const nextLocal =
        activeDate === todayLocal ? tomorrowLocal : dayAfterTomorrowLocal;

      // Lazy fetch next-day events only if we actually need them.
      let pyNextCache: Awaited<ReturnType<typeof fetchMoonEvents>> | undefined;
      const getPyNext = async () => {
        if (!pyNextCache)
          pyNextCache = await fetchMoonEvents(lat, lon, nextLocal);
        return pyNextCache;
      };

      let extNextCache: Awaited<ReturnType<typeof fetchMoonToday>> | undefined;
      const getExtNext = async () => {
        if (!extNextCache)
          extNextCache = await fetchMoonToday({
            lat,
            lon,
            tz,
            date: nextLocal,
          });
        return extNextCache;
      };

      // Pick the rise/set that match the current state of the Moon.
      //
      // Goal behavior:
      // - If the moon is currently up (alt > 0):
      //   - Moonrise shows when it most recently rose (could be yesterday)
      //   - Moonset shows when it will next set (could be tomorrow)
      // - If the moon is currently down (alt < 0):
      //   - Moonrise shows the next upcoming rise
      //   - Moonset shows when it most recently set
      let internalRise: string | undefined;
      let internalSet: string | undefined;
      let externalRise: string | undefined;
      let externalSet: string | undefined;

      if (moonIsUp) {
        // Most recent rise at/before now
        internalRise =
          pickLatestBeforeIso([pyActive.rise, pyPrev.rise], now) ??
          pyActive.rise ??
          pyPrev.rise;
        externalRise =
          pickLatestBeforeIso([extActive.rise, extPrev.rise], now) ??
          extActive.rise ??
          extPrev.rise;

        // Next set at/after now
        const internalSetCandidates: Array<string | undefined> = [pyActive.set];
        const externalSetCandidates: Array<string | undefined> = [
          extActive.set,
        ];

        if (!pyActive.set || isPast(pyActive.set, now)) {
          try {
            const pyNext = await getPyNext();
            internalSetCandidates.push(pyNext.set);
          } catch {
            // ignore
          }
        }
        if (!extActive.set || isPast(extActive.set, now)) {
          try {
            const extNext = await getExtNext();
            externalSetCandidates.push(extNext.set);
          } catch {
            // ignore
          }
        }

        internalSet =
          pickEarliestAfterIso(internalSetCandidates, now) ??
          pyActive.set ??
          internalSetCandidates.find((v) => !!v);
        externalSet =
          pickEarliestAfterIso(externalSetCandidates, now) ??
          extActive.set ??
          externalSetCandidates.find((v) => !!v);
      } else {
        // Next upcoming rise at/after now
        const internalRiseCandidates: Array<string | undefined> = [
          pyActive.rise,
        ];
        const externalRiseCandidates: Array<string | undefined> = [
          extActive.rise,
        ];

        if (!pyActive.rise || isPast(pyActive.rise, now)) {
          try {
            const pyNext = await getPyNext();
            internalRiseCandidates.push(pyNext.rise);
          } catch {
            // ignore
          }
        }
        if (!extActive.rise || isPast(extActive.rise, now)) {
          try {
            const extNext = await getExtNext();
            externalRiseCandidates.push(extNext.rise);
          } catch {
            // ignore
          }
        }

        internalRise =
          pickEarliestAfterIso(internalRiseCandidates, now) ??
          pyActive.rise ??
          internalRiseCandidates.find((v) => !!v);
        externalRise =
          pickEarliestAfterIso(externalRiseCandidates, now) ??
          extActive.rise ??
          externalRiseCandidates.find((v) => !!v);

        // Most recent set at/before now
        internalSet =
          pickLatestBeforeIso([pyPrev.set, pyActive.set], now) ??
          pyPrev.set ??
          pyActive.set;
        externalSet =
          pickLatestBeforeIso([extPrev.set, extActive.set], now) ??
          extPrev.set ??
          extActive.set;
      }

      const fallbackInternalHigh = approximateHighMoon(
        pyActive.rise,
        pyActive.set,
        tz,
      );
      const fallbackExternalHigh = approximateHighMoon(
        extActive.rise,
        extActive.set,
        tz,
      );

      return {
        internal: {
          rise: internalRise,
          set: internalSet,
          // prefer the value from the Python service, but use a fallback if missing
          highMoon: pyActive.highMoon ?? fallbackInternalHigh,
          lowMoon: pyActive.lowMoon,
          phaseName: pyActive.phaseName,
          prevRise: pyPrev.rise,
          prevSet: pyPrev.set,
        },
        external: {
          rise: externalRise,
          set: externalSet,
          highMoon: extActive.highMoon ?? fallbackExternalHigh,
          lowMoon: extActive.lowMoon,
          phaseName:
            extActive.phaseName ?? phaseNameFromDeg(extActive.phase ?? 0),
          prevRise: extPrev.rise,
          prevSet: extPrev.set,
        },
      };
    },
    staleTime: 30 * 60 * 1000,
  });
}
