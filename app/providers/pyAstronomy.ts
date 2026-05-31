import { resolveBaseUrl } from "../lib/baseUrl";

export interface AstronomySummary {
  meta: {
    source: string;
    generated_at_utc: string;
    cache_key: string;
    performance?: {
      timings_ms?: Record<string, number>;
      cache_keys?: Record<string, string>;
      cache?: Record<
        string,
        {
          status?: string;
          hits?: number;
          misses?: number;
          size?: number;
          max_size?: number;
        }
      >;
    };
    location: {
      latitude: number;
      longitude: number;
      elevation_m: number;
      timezone: string;
      timezone_offset: string;
    };
    date: {
      current_utc: string;
      current_local: string;
      local_date: string;
      previous_local_date: string;
      next_local_date: string;
    };
  };
  moon: {
    current: {
      observed_at_utc: string;
      observed_at_local: string;
      altitude_deg: number;
      azimuth_deg: number;
      illumination_frac: number;
      illumination_pct: number;
      phase_angle_deg: number;
      bright_limb_angle_deg: number;
      phase_name?: string | null;
      waxing: boolean;
      distance_km: number;
      above_horizon: boolean;
    };
    events: {
      rise_local?: string | null;
      set_local?: string | null;
      high_moon_local?: string | null;
      low_moon_local?: string | null;
      previous_rise_local?: string | null;
      previous_set_local?: string | null;
      today: AstronomyMoonEventSet;
      previous_day: AstronomyMoonEventSet;
      next_day: AstronomyMoonEventSet;
    };
    path: {
      window_start_local: string;
      window_end_local: string;
      sample_count: number;
      samples: Array<{
        time_utc: string;
        time_local: string;
        altitude_deg: number;
        azimuth_deg: number;
        above_horizon: boolean;
      }>;
    };
  };
  sun: {
    current: {
      observed_at_utc: string;
      observed_at_local: string;
      altitude_deg: number;
      azimuth_deg: number;
      above_horizon: boolean;
    };
    events: {
      sunrise_local?: string | null;
      sunset_local?: string | null;
    };
    path: {
      window_start_local: string;
      window_end_local: string;
      sample_count: number;
      samples: Array<{
        time_utc: string;
        time_local: string;
        altitude_deg: number;
        azimuth_deg: number;
      }>;
    };
  };
  twilight: {
    timezone_offset: string;
    current_phase: string;
    next_transition_local?: string | null;
    segments: Array<{
      phase: string;
      start_local: string;
      end_local: string;
    }>;
    sun_events: {
      sunrise_local?: string | null;
      sunset_local?: string | null;
    };
  };
}

export interface AstronomyMoonEventSet {
  rise_local?: string | null;
  set_local?: string | null;
  high_moon_local?: string | null;
  low_moon_local?: string | null;
  phase_name?: string | null;
}

export interface MoonPhaseWindow {
  meta: {
    source: string;
    generated_at_utc: string;
    cache_key: string;
    timezone: string;
    window_start_local_date: string;
    window_end_local_date: string;
    window_days: number;
    today_local_date: string;
  };
  days: Array<{
    date_local: string;
    weekday_short: string;
    is_today: boolean;
    phases: Array<{
      key: string;
      label: string;
      short_label: string;
      phase_angle_deg: number;
      illumination_frac: number;
      waxing: boolean;
      instant_local: string;
      instant_utc: string;
    }>;
  }>;
}

export async function fetchAstronomySummary(
  lat: number,
  lon: number,
  tz: string,
  datetimeIso: string,
  baseUrl?: string,
): Promise<AstronomySummary> {
  const origin = resolveBaseUrl(baseUrl);
  if (!origin) throw new Error("missing-base-url");

  const url = new URL("/api/py-astro", origin);
  url.searchParams.set("mode", "summary");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("tz", tz);
  url.searchParams.set("datetime_iso", datetimeIso);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("py-astro-summary-failed");
  return res.json();
}

export async function fetchMoonPhaseWindow(
  tz: string,
  startDateIso: string,
  windowDays: number,
  baseUrl?: string,
): Promise<MoonPhaseWindow> {
  const origin = resolveBaseUrl(baseUrl);
  if (!origin) throw new Error("missing-base-url");

  const url = new URL("/api/py-astro", origin);
  url.searchParams.set("mode", "phases");
  url.searchParams.set("tz", tz);
  url.searchParams.set("start_date_iso", startDateIso);
  url.searchParams.set("window_days", String(windowDays));

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("py-astro-phases-failed");
  return res.json();
}
