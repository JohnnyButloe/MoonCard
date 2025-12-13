import { formatInTimeZone } from "date-fns-tz";

export type MoonToday = {
  rise?: string;
  set?: string;
  highMoon?: string;
  lowMoon?: string;
  phaseDeg?: number;
};

export function phaseNameFromDeg(deg: number | undefined): string | undefined {
  if (deg == null) return;
  if (deg === 0) return "New Moon";
  if (deg > 0 && deg < 90) return "Waxing Crescent";
  if (deg === 90) return "First Quarter";
  if (deg > 90 && deg < 180) return "Waxing Gibbous";
  if (deg === 180) return "Full Moon";
  if (deg > 180 && deg < 270) return "Waning Gibbous";
  if (deg === 270) return "Last Quarter";
  if (deg > 270 && deg < 360) return "Waning Crescent";
  return undefined;
}

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

  // Convert IANA tz to "±HH:MM" offset for MET
  const now = new Date();
  const offset = formatInTimeZone(now, params.tz, "xxx");
  url.searchParams.set("offset", offset);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("moon-today-failed");
  const json = await res.json();

  // Sunrise 3.0 Moon Properties:
  // properties.moonrise.time, .moonset.timem .high_moon.time, .low_moon.time
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

  return {
    rise: riseISO,
    set: adjustedSetISO,
    highMoon: toISOInTZ(p?.high_moon?.time, params.tz),
    lowMoon: toISOInTZ(p?.low_moon?.time, params.tz),
    phaseDeg: p?.moonphase ?? p?.moon_phase?.value,
  };
}
