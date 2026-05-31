import type { MoonCardError } from "../../lib/mooncard/errors";
import {
  normalizeMoonCardRequest,
  type MoonCardNormalizedRequest,
} from "../../lib/mooncard/normalizeRequest";
import type {
  MoonCardApiErrorResponse,
  MoonCardRequest,
  MoonCardResponse,
} from "../../lib/mooncard/types";
import type { MoonCardPythonResponse } from "../../lib/mooncard/mapPythonResponse";
import type {
  AstronomySummary,
  MoonPhaseWindow,
} from "../../providers/pyAstronomy";
import type { WeatherNow } from "../../providers/weather";

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeFixture<T>(base: T, overrides?: DeepPartial<T>): T {
  if (overrides === undefined) {
    return structuredClone(base);
  }

  if (!isRecord(base) || !isRecord(overrides)) {
    return structuredClone(overrides as T);
  }

  const output = structuredClone(base) as Record<string, unknown>;

  for (const [key, overrideValue] of Object.entries(overrides)) {
    if (overrideValue === undefined) continue;

    const existingValue = output[key];
    if (Array.isArray(overrideValue)) {
      output[key] = structuredClone(overrideValue) as unknown;
      continue;
    }

    if (isRecord(existingValue) && isRecord(overrideValue)) {
      output[key] = mergeFixture(existingValue, overrideValue);
      continue;
    }

    output[key] = structuredClone(overrideValue as unknown);
  }

  return output as T;
}

export function buildMoonCardRequest(
  overrides?: DeepPartial<MoonCardRequest>,
): MoonCardRequest {
  return mergeFixture(
    {
      location: {
        lat: 40.7128,
        lon: -74.006,
        label: "Testville",
      },
      datetime: {
        date: "2026-04-05" as MoonCardRequest["datetime"]["date"],
        time: "06:30" as MoonCardRequest["datetime"]["time"],
        timezone: "UTC",
      },
      options: {
        includeSun: true,
        includeMoon: true,
        includeTwilight: true,
        includeVisibility: true,
      },
      source: {
        requestOrigin: "dashboard",
      },
    } satisfies MoonCardRequest,
    overrides,
  );
}

export function buildNormalizedMoonCardRequest(
  overrides?: DeepPartial<MoonCardRequest>,
): MoonCardNormalizedRequest {
  const normalized = normalizeMoonCardRequest(buildMoonCardRequest(overrides));
  if (!normalized.ok) {
    throw new Error(
      `Fixture request normalization failed: ${normalized.errors[0]?.message ?? "unknown"}`,
    );
  }

  return normalized.value;
}

export function buildPythonMoonCardResponse(
  overrides?: DeepPartial<MoonCardPythonResponse>,
): MoonCardPythonResponse {
  return mergeFixture(
    {
      meta: {
        calculation_source: "python_microservice",
        data_version: "mooncard/v1",
        units: {
          angles: "degrees",
          illumination: "fraction",
        },
      },
      moon: {
        phase_name: "Waxing Gibbous",
        phase_angle_deg: 134.8,
        illumination_fraction: 0.74,
        illumination_percent: 74,
        altitude_deg: 32.4,
        azimuth_deg: 143.2,
        distance_km: 405123,
        is_up: true,
        moonrise: "2026-04-05T01:15:00Z",
        moonset: "2026-04-05T13:45:00Z",
        high_moon: "2026-04-05T07:20:00Z",
        low_moon: "2026-04-05T19:50:00Z",
        path: {
          window_start_local: "2026-04-05T00:00:00+00:00",
          window_end_local: "2026-04-06T00:00:00+00:00",
          sample_count: 220,
          samples: [
            {
              time_utc: "2026-04-05T00:00:00Z",
              time_local: "2026-04-05T00:00:00+00:00",
              altitude_deg: -18.4,
              azimuth_deg: 91.2,
              above_horizon: false,
            },
            {
              time_utc: "2026-04-05T06:30:00Z",
              time_local: "2026-04-05T06:30:00+00:00",
              altitude_deg: 32.4,
              azimuth_deg: 143.2,
              above_horizon: true,
            },
            {
              time_utc: "2026-04-06T00:00:00Z",
              time_local: "2026-04-06T00:00:00+00:00",
              altitude_deg: -27.6,
              azimuth_deg: 287.1,
              above_horizon: false,
            },
          ],
        },
      },
      sun: {
        altitude_deg: -12.4,
        azimuth_deg: 73.2,
        is_up: false,
        sunrise: "2026-04-05T06:42:00Z",
        sunset: "2026-04-05T19:15:00Z",
      },
      twilight: {
        current_phase: "astronomical",
        next_transition: "2026-04-05T05:55:00Z",
        civil_dawn: "2026-04-05T06:15:00Z",
        civil_dusk: "2026-04-05T19:42:00Z",
        nautical_dawn: "2026-04-05T05:42:00Z",
        nautical_dusk: "2026-04-05T20:12:00Z",
        astronomical_dawn: "2026-04-05T05:12:00Z",
        astronomical_dusk: "2026-04-05T20:42:00Z",
        segments: [
          {
            phase: "dark",
            start: "2026-04-05T00:00:00Z",
            end: "2026-04-05T05:12:00Z",
          },
          {
            phase: "astronomical",
            start: "2026-04-05T05:12:00Z",
            end: "2026-04-05T05:42:00Z",
          },
          {
            phase: "nautical",
            start: "2026-04-05T05:42:00Z",
            end: "2026-04-05T06:15:00Z",
          },
          {
            phase: "civil",
            start: "2026-04-05T06:15:00Z",
            end: "2026-04-05T06:42:00Z",
          },
          {
            phase: "day",
            start: "2026-04-05T06:42:00Z",
            end: "2026-04-05T19:15:00Z",
          },
        ],
      },
      visibility: {
        is_dark_enough_for_viewing: true,
        summary: "Astronomical twilight still supports darker-sky viewing.",
      },
      errors: [],
    } satisfies MoonCardPythonResponse,
    overrides,
  );
}

export function buildCanonicalMoonCardResponse(
  overrides?: DeepPartial<MoonCardResponse>,
): MoonCardResponse {
  return mergeFixture(
    {
      meta: {
        location: {
          lat: 40.7128,
          lon: -74.006,
          label: "Testville",
        },
        requested_datetime: {
          date: "2026-04-05" as MoonCardResponse["meta"]["requested_datetime"]["date"],
          time: "06:30" as MoonCardResponse["meta"]["requested_datetime"]["time"],
          timezone: "UTC",
        },
        timestamp_iso: "2026-04-05T06:30:00Z" as MoonCardResponse["meta"]["timestamp_iso"],
        calculation_source: "python_microservice",
        data_version: "mooncard/v1",
        units: {
          angles: "degrees",
          illumination: "fraction",
        },
      },
      moon: {
        phase_name: "Waxing Gibbous",
        phase_angle_deg: 134.8,
        illumination_fraction: 0.74,
        illumination_percent: 74,
        altitude_deg: 32.4,
        azimuth_deg: 143.2,
        distance_km: 405123,
        is_up: true,
        moonrise: "2026-04-05T01:15:00Z",
        moonset: "2026-04-05T13:45:00Z",
        high_moon: "2026-04-05T07:20:00Z",
        low_moon: "2026-04-05T19:50:00Z",
        path: {
          window_start_local: "2026-04-05T00:00:00+00:00",
          window_end_local: "2026-04-06T00:00:00+00:00",
          sample_count: 220,
          samples: [
            {
              time_utc: "2026-04-05T00:00:00Z",
              time_local: "2026-04-05T00:00:00+00:00",
              altitude_deg: -18.4,
              azimuth_deg: 91.2,
              above_horizon: false,
            },
            {
              time_utc: "2026-04-05T06:30:00Z",
              time_local: "2026-04-05T06:30:00+00:00",
              altitude_deg: 32.4,
              azimuth_deg: 143.2,
              above_horizon: true,
            },
            {
              time_utc: "2026-04-06T00:00:00Z",
              time_local: "2026-04-06T00:00:00+00:00",
              altitude_deg: -27.6,
              azimuth_deg: 287.1,
              above_horizon: false,
            },
          ],
        },
      },
      sun: {
        altitude_deg: -12.4,
        azimuth_deg: 73.2,
        is_up: false,
        sunrise: "2026-04-05T06:42:00Z",
        sunset: "2026-04-05T19:15:00Z",
      },
      twilight: {
        current_phase: "astronomical",
        next_transition: "2026-04-05T05:55:00Z",
        civil_dawn: "2026-04-05T06:15:00Z",
        civil_dusk: "2026-04-05T19:42:00Z",
        nautical_dawn: "2026-04-05T05:42:00Z",
        nautical_dusk: "2026-04-05T20:12:00Z",
        astronomical_dawn: "2026-04-05T05:12:00Z",
        astronomical_dusk: "2026-04-05T20:42:00Z",
        segments: [
          {
            phase: "dark",
            start: "2026-04-05T00:00:00Z",
            end: "2026-04-05T05:12:00Z",
          },
          {
            phase: "astronomical",
            start: "2026-04-05T05:12:00Z",
            end: "2026-04-05T05:42:00Z",
          },
          {
            phase: "nautical",
            start: "2026-04-05T05:42:00Z",
            end: "2026-04-05T06:15:00Z",
          },
          {
            phase: "civil",
            start: "2026-04-05T06:15:00Z",
            end: "2026-04-05T06:42:00Z",
          },
          {
            phase: "day",
            start: "2026-04-05T06:42:00Z",
            end: "2026-04-05T19:15:00Z",
          },
        ],
      },
      visibility: {
        is_dark_enough_for_viewing: true,
        summary: "Astronomical twilight still supports darker-sky viewing.",
      },
      errors: [],
    } satisfies MoonCardResponse,
    overrides,
  );
}

function buildWindowDay(
  dateLocal: string,
  weekdayShort: string,
  phaseEntries: MoonPhaseWindow["days"][number]["phases"],
  isToday = false,
): MoonPhaseWindow["days"][number] {
  return {
    date_local: dateLocal,
    weekday_short: weekdayShort,
    is_today: isToday,
    phases: phaseEntries,
  };
}

export function buildAstronomySummary(
  overrides?: DeepPartial<AstronomySummary>,
): AstronomySummary {
  return mergeFixture(
    {
      meta: {
        source: "python_service",
        generated_at_utc: "2026-04-05T06:30:00Z",
        cache_key: "astronomy:test",
        performance: {
          timings_ms: {
            context_ms: 0.2,
            today_bundle_ms: 1.3,
            previous_bundle_ms: 0.4,
            next_bundle_ms: 0.5,
            sun_path_ms: 2.2,
            moon_path_ms: 2.4,
            moon_current_ms: 1.1,
            sun_current_ms: 0.8,
            assembly_ms: 0.1,
            total_ms: 9,
          },
          cache_keys: {
            summary_bundle: "astronomy:test",
            moon_path: "astronomy-moon-path:test",
            sun_path: "astronomy-sun-path:test",
          },
          cache: {
            today_bundle: {
              status: "hit",
              hits: 4,
              misses: 1,
              size: 3,
              max_size: 1024,
            },
            previous_bundle: {
              status: "hit",
              hits: 5,
              misses: 1,
              size: 3,
              max_size: 1024,
            },
            next_bundle: {
              status: "miss",
              hits: 5,
              misses: 2,
              size: 4,
              max_size: 1024,
            },
            sun_path: {
              status: "hit",
              hits: 8,
              misses: 2,
              size: 1,
              max_size: 256,
            },
            moon_path: {
              status: "hit",
              hits: 7,
              misses: 2,
              size: 1,
              max_size: 256,
            },
          },
        },
        location: {
          latitude: 40.7128,
          longitude: -74.006,
          elevation_m: 0,
          timezone: "UTC",
          timezone_offset: "+00:00",
        },
        date: {
          current_utc: "2026-04-05T06:30:00Z",
          current_local: "2026-04-05T06:30:00+00:00",
          local_date: "2026-04-05",
          previous_local_date: "2026-04-04",
          next_local_date: "2026-04-06",
        },
      },
      moon: {
        current: {
          observed_at_utc: "2026-04-05T06:30:00Z",
          observed_at_local: "2026-04-05T06:30:00+00:00",
          altitude_deg: 32.4,
          azimuth_deg: 143.2,
          illumination_frac: 0.74,
          illumination_pct: 74,
          phase_angle_deg: 134.8,
          bright_limb_angle_deg: 45.3,
          phase_name: "Waxing Gibbous",
          waxing: true,
          distance_km: 405123,
          above_horizon: true,
        },
        events: {
          rise_local: "2026-04-05T01:15:00+00:00",
          set_local: "2026-04-05T13:45:00+00:00",
          high_moon_local: "2026-04-05T07:20:00+00:00",
          low_moon_local: "2026-04-05T19:50:00+00:00",
          previous_rise_local: "2026-04-04T00:48:00+00:00",
          previous_set_local: "2026-04-04T12:58:00+00:00",
          today: {
            rise_local: "2026-04-05T01:15:00+00:00",
            set_local: "2026-04-05T13:45:00+00:00",
            high_moon_local: "2026-04-05T07:20:00+00:00",
            low_moon_local: "2026-04-05T19:50:00+00:00",
            phase_name: "Waxing Gibbous",
          },
          previous_day: {
            rise_local: "2026-04-04T00:48:00+00:00",
            set_local: "2026-04-04T12:58:00+00:00",
            high_moon_local: "2026-04-04T06:34:00+00:00",
            low_moon_local: "2026-04-04T18:58:00+00:00",
            phase_name: "Waxing Gibbous",
          },
          next_day: {
            rise_local: "2026-04-06T01:42:00+00:00",
            set_local: "2026-04-06T14:31:00+00:00",
            high_moon_local: "2026-04-06T08:04:00+00:00",
            low_moon_local: "2026-04-06T20:34:00+00:00",
            phase_name: "Waxing Gibbous",
          },
        },
        path: {
          window_start_local: "2026-04-05T00:00:00+00:00",
          window_end_local: "2026-04-06T00:00:00+00:00",
          sample_count: 220,
          samples: [
            {
              time_utc: "2026-04-05T00:00:00Z",
              time_local: "2026-04-05T00:00:00+00:00",
              altitude_deg: -18.4,
              azimuth_deg: 91.2,
              above_horizon: false,
            },
            {
              time_utc: "2026-04-05T06:30:00Z",
              time_local: "2026-04-05T06:30:00+00:00",
              altitude_deg: 32.4,
              azimuth_deg: 143.2,
              above_horizon: true,
            },
            {
              time_utc: "2026-04-06T00:00:00Z",
              time_local: "2026-04-06T00:00:00+00:00",
              altitude_deg: -27.6,
              azimuth_deg: 287.1,
              above_horizon: false,
            },
          ],
        },
      },
      sun: {
        current: {
          observed_at_utc: "2026-04-05T06:30:00Z",
          observed_at_local: "2026-04-05T06:30:00+00:00",
          altitude_deg: -12.4,
          azimuth_deg: 73.2,
          above_horizon: false,
        },
        events: {
          sunrise_local: "2026-04-05T06:42:00+00:00",
          sunset_local: "2026-04-05T19:15:00+00:00",
        },
        path: {
          window_start_local: "2026-04-05T00:26:00+00:00",
          window_end_local: "2026-04-06T01:31:00+00:00",
          sample_count: 220,
          samples: [
            {
              time_utc: "2026-04-05T00:26:00Z",
              time_local: "2026-04-05T00:26:00+00:00",
              altitude_deg: -42.1,
              azimuth_deg: 335.8,
            },
            {
              time_utc: "2026-04-05T12:58:30Z",
              time_local: "2026-04-05T12:58:30+00:00",
              altitude_deg: 41.7,
              azimuth_deg: 179.3,
            },
            {
              time_utc: "2026-04-06T01:31:00Z",
              time_local: "2026-04-06T01:31:00+00:00",
              altitude_deg: -39.4,
              azimuth_deg: 25.4,
            },
          ],
        },
      },
      twilight: {
        timezone_offset: "+00:00",
        current_phase: "astronomical",
        next_transition_local: "2026-04-05T05:55:00+00:00",
        segments: [
          {
            phase: "dark",
            start_local: "2026-04-05T00:00:00+00:00",
            end_local: "2026-04-05T05:12:00+00:00",
          },
          {
            phase: "astronomical",
            start_local: "2026-04-05T05:12:00+00:00",
            end_local: "2026-04-05T05:42:00+00:00",
          },
          {
            phase: "nautical",
            start_local: "2026-04-05T05:42:00+00:00",
            end_local: "2026-04-05T06:15:00+00:00",
          },
          {
            phase: "civil",
            start_local: "2026-04-05T06:15:00+00:00",
            end_local: "2026-04-05T06:42:00+00:00",
          },
          {
            phase: "day",
            start_local: "2026-04-05T06:42:00+00:00",
            end_local: "2026-04-05T19:15:00+00:00",
          },
        ],
        sun_events: {
          sunrise_local: "2026-04-05T06:42:00+00:00",
          sunset_local: "2026-04-05T19:15:00+00:00",
        },
      },
    } satisfies AstronomySummary,
    overrides,
  );
}

export function buildMoonPhaseWindow(
  overrides?: DeepPartial<MoonPhaseWindow>,
): MoonPhaseWindow {
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const start = new Date("2026-04-05T12:00:00Z");
  const days: MoonPhaseWindow["days"] = Array.from({ length: 35 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    const dateLocal = day.toISOString().slice(0, 10);
    const weekdayShort = weekdayLabels[day.getUTCDay()] ?? "Sun";
    const phases =
      index === 1
        ? [
            {
              key: "first_quarter",
              label: "First Quarter",
              short_label: "1Q",
              phase_angle_deg: 90,
              illumination_frac: 0.5,
              waxing: true,
              instant_local: "2026-04-06T21:12:00Z",
              instant_utc: "2026-04-06T21:12:00Z",
            },
          ]
        : index === 9
          ? [
              {
                key: "full_moon",
                label: "Full Moon",
                short_label: "Full",
                phase_angle_deg: 180,
                illumination_frac: 1,
                waxing: false,
                instant_local: "2026-04-14T03:45:00Z",
                instant_utc: "2026-04-14T03:45:00Z",
              },
            ]
          : [];

    return buildWindowDay(dateLocal, weekdayShort, phases, index === 0);
  });

  return mergeFixture(
    {
      meta: {
        source: "python_microservice",
        generated_at_utc: "2026-04-05T06:30:00Z",
        cache_key: "phase-window:test",
        timezone: "UTC",
        window_start_local_date: "2026-04-05",
        window_end_local_date: "2026-05-09",
        window_days: 35,
        today_local_date: "2026-04-05",
      },
      days,
    } satisfies MoonPhaseWindow,
    overrides,
  );
}

export function buildWeatherNow(
  overrides?: DeepPartial<WeatherNow>,
): WeatherNow {
  return mergeFixture(
    {
      condition: "clear",
      cloudCoverPct: 18,
      precipitationMm: 0,
      rainMm: 0,
      showersMm: 0,
      snowfallMm: 0,
      weatherCode: 0,
    } satisfies WeatherNow,
    overrides,
  );
}

export function buildCanonicalApiErrorResponse(
  errors: MoonCardError[],
): MoonCardApiErrorResponse {
  return {
    ok: false,
    data: null,
    errors,
  };
}

export function buildQueryResult<T>(input?: {
  data?: T;
  error?: Error | null;
  isLoading?: boolean;
  isFetching?: boolean;
  dataUpdatedAt?: number;
}) {
  return {
    data: input?.data,
    error: input?.error ?? null,
    isLoading: input?.isLoading ?? false,
    isFetching: input?.isFetching ?? false,
    dataUpdatedAt: input?.dataUpdatedAt ?? Date.parse("2026-04-05T06:30:00Z"),
  };
}
