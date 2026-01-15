import { formatInTimeZone } from "date-fns-tz";

// NOTE: This provider adapts MET Norway Sunrise 3.0 (Moon) responses into our normalized shape.
// It is intentionally kept separate from the internal Python ephemeris provider (pyMoon).

export type MoonToday = {
  rise?: string;
  set?: string;
  highMoon?: string;
  lowMoon?: string;
  phaseDeg?: number;
};

// Re-export the shared phase helper so existing imports (e.g. from useLunar.ts)
// can continue to import from "../providers/metno" without change.
export { phaseNameFromDeg } from "../lib/lunarPhase";

function toISOInTZ(raw: string | undefined, tz: string): string | undefined {
  if (!raw) return;
  // raw can be "2025-11-10T02:01+01:00" -> create Date and reformat in tz
  const d = new Date(raw);
  return formatInTimeZone(d, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

export async function fetchMoonToday(params: {
  lat: number;
  lon: number;
  date: string;
  tz: string;
}): Promise<MoonToday> {
  const url = new URL("/api/metno/moon", location.origin);
  url.searchParams.set("lat", String(params.lat));
  url.searchParams.set("lon", String(params.lon));
  url.searchParams.set("date", params.date);

  // Convert IANA tz to "±HH:MM" offset for MET.
  // Sunrise 3.0 uses an `offset` parameter to return timestamps in local time.
  const now = new Date();
  const offset = formatInTimeZone(now, params.tz, "xxx");
  url.searchParams.set("offset", offset);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("moon-today-failed");
  const json = await res.json();

  // Sunrise 3.0 Moon Properties:
  // properties.moonrise.time, moonset.time, high_moon.time, low_moon.time
  const p = json?.properties ?? json?.features?.[0]?.properties;

  // Convert raw MET times to ISO in the user's timezone
  const riseISO = toISOInTZ(p?.moonrise?.time, params.tz);
  const setISO = toISOInTZ(p?.moonset?.time, params.tz);

  let adjustedSetISO = setISO;

  if (riseISO && setISO) {
    const riseDate = new Date(riseISO);
    const setDate = new Date(setISO);

    // If the reported moonset happens earlier in the day than moonrise,
    // it actually belongs to the *next* calendar day (same "night").
    if (setDate <= riseDate) {
      setDate.setDate(setDate.getDate() + 1);

      adjustedSetISO = formatInTimeZone(
        setDate,
        params.tz,
        "yyyy-MM-dd'T'HH:mm:ssXXX"
      );
    }
  }

  // MET commonly returns { moonphase: { value: number } } in many clients/examples,
  // but some intermediates may flatten it to moonphase: number. Support both.
  const phaseDeg = p?.moonphase?.value ?? p?.moonphase ?? p?.moon_phase?.value;

  return {
    rise: riseISO,
    set: adjustedSetISO,
    highMoon: toISOInTZ(p?.high_moon?.time, params.tz),
    lowMoon: toISOInTZ(p?.low_moon?.time, params.tz),
    phaseDeg,
  };
}
