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
import type { MoonPhaseWindow } from "../../providers/pyAstronomy";
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
        date: "2026-04-05",
        time: "06:30",
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
