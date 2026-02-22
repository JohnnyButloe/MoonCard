// app/providers/pyMoon.ts
import { resolveBaseUrl } from "../lib/baseUrl";

export type MoonPhasePayload = {
  illumination: number;
  waxing: boolean;
  phase_angle_deg: number;
  bright_limb_angle_deg: number;
};

export type MoonNow = {
  alt_deg: number;
  az_deg: number;
  illum_frac: number;
  phase_angle_deg: number;
  distance_km: number;
  phase_name?: string;
  jd_tt?: number;
  moon_illumination: number;
  moon_phase_angle_deg: number;
  moon_bright_limb_angle_deg: number;
  moon_waxing: boolean;
  moon: MoonPhasePayload;

  // Legacy optional fields (kept for compatibility).
  phase_angle?: number;
  ra_hours?: number;
  dec_deg?: number;
  phase_deg?: number;
  bright_limb_angle_deg?: number;
  waxing?: boolean;
};

type MoonNowRaw = Partial<MoonNow> & {
  moon?: Partial<MoonPhasePayload>;
};

export type MoonEvents = {
  rise?: string;
  set?: string;
  high_moon?: string;
  low_moon?: string;
  phase_name?: string;
};

// Helper: ensure moonset belongs to the same "night" as moonrise.
// Some astronomy libraries report the following-morning moonset
// using the *same* calendar date as the previous-evening moonrise.
// For display, we want moonset to be shown on the next calendar day
// when that happens (e.g. rise Dec 6 18:32, set Dec 7 09:08).
function adjustMoonsetForNight(events: MoonEvents): MoonEvents {
  const { rise, set } = events;

  if (!rise || !set) return events;

  // Match basic ISO-8601-like strings: YYYY-MM-DDTHH:mm...
  const riseMatch = rise.match(/^([0-9]{4}-[0-9]{2}-[0-9]{2})T(.+)$/);
  const setMatch = set.match(/^([0-9]{4}-[0-9]{2}-[0-9]{2})T(.+)$/);

  if (!riseMatch || !setMatch) return events;

  const [, riseDatePart] = riseMatch;
  const [, setDatePart, setRest] = setMatch;

  // Only adjust when the service says moonset is on the *same*
  // calendar date as moonrise but an earlier time of day.
  if (riseDatePart === setDatePart && set <= rise) {
    // Bump the date portion by one day, keeping the original
    // local time-of-day and offset string intact.
    const base = new Date(
      Date.UTC(
        Number(setDatePart.slice(0, 4)), // year
        Number(setDatePart.slice(5, 7)) - 1, // month (0-indexed)
        Number(setDatePart.slice(8, 10)), // day
      ),
    );

    base.setUTCDate(base.getUTCDate() + 1);

    const year = base.getUTCFullYear();
    const month = String(base.getUTCMonth() + 1).padStart(2, "0");
    const day = String(base.getUTCDate()).padStart(2, "0");
    const nextDatePart = `${year}-${month}-${day}`;

    return {
      ...events,
      set: `${nextDatePart}T${setRest}`,
    };
  }

  return events;
}

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeMoonNow(raw: MoonNowRaw): MoonNow {
  const illum = asFiniteNumber(
    raw?.moon_illumination ?? raw?.moon?.illumination ?? raw?.illum_frac,
    0,
  );
  const phaseAngle = asFiniteNumber(
    raw?.moon_phase_angle_deg ??
      raw?.moon?.phase_angle_deg ??
      raw?.phase_angle_deg ??
      raw?.phase_angle,
    0,
  );
  const brightLimb = asFiniteNumber(
    raw?.moon_bright_limb_angle_deg ?? raw?.moon?.bright_limb_angle_deg,
    0,
  );
  const waxing =
    typeof raw?.moon_waxing === "boolean"
      ? raw.moon_waxing
      : typeof raw?.moon?.waxing === "boolean"
        ? raw.moon.waxing
        : phaseAngle < 180;

  return {
    ...raw,
    alt_deg: asFiniteNumber(raw?.alt_deg, 0),
    az_deg: asFiniteNumber(raw?.az_deg, 0),
    illum_frac: asFiniteNumber(raw?.illum_frac, illum),
    phase_angle_deg: asFiniteNumber(raw?.phase_angle_deg, phaseAngle),
    distance_km: asFiniteNumber(raw?.distance_km, 0),
    moon_illumination: illum,
    moon_phase_angle_deg: phaseAngle,
    moon_bright_limb_angle_deg: brightLimb,
    moon_waxing: waxing,
    moon: {
      illumination: illum,
      waxing,
      phase_angle_deg: phaseAngle,
      bright_limb_angle_deg: brightLimb,
    },
  };
}

export async function fetchMoonNow(
  lat: number,
  lon: number,
  dateTimeIso: string,
  baseUrl?: string,
): Promise<MoonNow> {
  const origin = resolveBaseUrl(baseUrl);
  if (!origin) throw new Error("missing-base-url");
  const url = new URL("/api/py-moon", origin);
  url.searchParams.set("mode", "now");
  url.searchParams.set("datetime_iso", dateTimeIso);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("py-moon-now-failed");
  const raw = (await res.json()) as MoonNowRaw;
  return normalizeMoonNow(raw);
}

export async function fetchMoonEvents(
  lat: number,
  lon: number,
  dateIso: string,
  baseUrl?: string,
): Promise<MoonEvents> {
  const origin = resolveBaseUrl(baseUrl);
  if (!origin) throw new Error("missing-base-url");
  const url = new URL("/api/py-moon", origin);
  url.searchParams.set("mode", "events");
  url.searchParams.set("date_iso", dateIso);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("py-moon-events-failed");

  const events: MoonEvents = await res.json();
  return adjustMoonsetForNight(events);
}
