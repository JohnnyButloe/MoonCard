import { keepPreviousData } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";

// External providers: SunCalc and MET Norway API
import { getMoonNow } from "../lib/suncalc";
import { fetchMoonToday, phaseNameFromDeg } from "../providers/metno";

// Internal providers: our Python ephemeris service
import { fetchMoonNow, fetchMoonEvents } from "../providers/pyMoon";

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
    phaseName?: string;
  };
  external: {
    altDeg: number;
    azDeg: number;
    illumPct: number;
    phaseName?: string;
  };
};

export type MoonEventsResult = {
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

type LunarQueryArgs = {
  lat: number;
  lon: number;
  tz: string;
  baseUrl?: string;
};

function shiftLocalDate(base: Date, tz: string, deltaDays: number): string {
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

export function lunarNowQueryOptions({
  lat,
  lon,
  tz,
  baseUrl,
}: LunarQueryArgs) {
  const enabled =
    Number.isFinite(lat) && Number.isFinite(lon) && typeof tz === "string" && tz.length > 0;

  return {
    queryKey: ["lunar-now-compare", lat, lon, tz],
    enabled,
    queryFn: async () => {
      const now = new Date();
      const whenISO = formatInTimeZone(now, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");

      const isoUtc = now.toISOString();

      const py = await fetchMoonNow(lat, lon, isoUtc, baseUrl);
      const sc = getMoonNow(lat, lon, now);

      return {
        whenISO,
        internal: {
          altDeg: py.alt_deg,
          azDeg: py.az_deg,
          illumPct: Math.round(py.moon.illumination * 100),
          illumination: py.moon.illumination,
          waxing: py.moon.waxing,
          phaseAngleDeg: py.moon.phase_angle_deg,
          brightLimbAngleDeg: py.moon.bright_limb_angle_deg,
          phaseName: py.phase_name,
          // Convert position angle to an SVG rotation (0° = bright on right).
          tiltDeg:
            py.bright_limb_angle_deg !== undefined
              ? py.bright_limb_angle_deg - 270
              : undefined,
        },
        external: {
          altDeg: sc.altDeg,
          azDeg: sc.azDeg,
          illumPct: Math.round(sc.frac * 100),
          phaseName: phaseNameFromDeg(sc.phase * 360),
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
    Number.isFinite(lat) && Number.isFinite(lon) && typeof tz === "string" && tz.length > 0;

  return {
    queryKey: ["moon-today-compare", lat, lon, tz],
    enabled,
    queryFn: async () => {
      const now = new Date();

      const todayLocal = formatInTimeZone(now, tz, "yyyy-MM-dd");
      const yesterdayLocal = shiftLocalDate(now, tz, -1);
      const tomorrowLocal = shiftLocalDate(now, tz, +1);

      const [pyToday, extToday] = await Promise.all([
        fetchMoonEvents(lat, lon, todayLocal, tz, baseUrl),
        fetchMoonToday({ lat, lon, tz, date: todayLocal, baseUrl }),
      ]);

      const setForSwitch = extToday.set ?? pyToday.set;
      const moonsetPassed = isPast(setForSwitch, now);

      const scNow = getMoonNow(lat, lon, now);
      const moonIsUp = scNow.altDeg > 0;

      const activeDate =
        moonsetPassed && !moonIsUp ? tomorrowLocal : todayLocal;
      const previousDate =
        activeDate === todayLocal ? yesterdayLocal : todayLocal;

      const [pyActive, pyPrev, extActive, extPrev] = await Promise.all([
        activeDate === todayLocal
          ? Promise.resolve(pyToday)
          : fetchMoonEvents(lat, lon, activeDate, tz, baseUrl),
        previousDate === todayLocal
          ? Promise.resolve(pyToday)
          : fetchMoonEvents(lat, lon, previousDate, tz, baseUrl),

        activeDate === todayLocal
          ? Promise.resolve(extToday)
          : fetchMoonToday({ lat, lon, tz, date: activeDate, baseUrl }),
        previousDate === todayLocal
          ? Promise.resolve(extToday)
          : fetchMoonToday({ lat, lon, tz, date: previousDate, baseUrl }),
      ]);

      const dayAfterTomorrowLocal = shiftLocalDate(now, tz, +2);
      const nextLocal =
        activeDate === todayLocal ? tomorrowLocal : dayAfterTomorrowLocal;

      let pyNextCache: Awaited<ReturnType<typeof fetchMoonEvents>> | undefined;
      const getPyNext = async () => {
        if (!pyNextCache)
          pyNextCache = await fetchMoonEvents(lat, lon, nextLocal, tz, baseUrl);
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
            baseUrl,
          });
        return extNextCache;
      };

      let internalRise: string | undefined;
      let internalSet: string | undefined;
      let externalRise: string | undefined;
      let externalSet: string | undefined;

      if (moonIsUp) {
        internalRise =
          pickLatestBeforeIso([pyActive.rise, pyPrev.rise], now) ??
          pyActive.rise ??
          pyPrev.rise;
        externalRise =
          pickLatestBeforeIso([extActive.rise, extPrev.rise], now) ??
          extActive.rise ??
          extPrev.rise;

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
          highMoon: pyActive.high_moon ?? fallbackInternalHigh,
          lowMoon: pyActive.low_moon,
          phaseName: pyActive.phase_name,
          prevRise: pyPrev.rise,
          prevSet: pyPrev.set,
        },
        external: {
          rise: externalRise,
          set: externalSet,
          highMoon: extActive.highMoon ?? fallbackExternalHigh,
          lowMoon: extActive.lowMoon,
          phaseName:
            typeof extActive.phaseDeg === "number"
              ? phaseNameFromDeg(extActive.phaseDeg)
              : undefined,
          prevRise: extPrev.rise,
          prevSet: extPrev.set,
        },
      };
    },
    staleTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  };
}
