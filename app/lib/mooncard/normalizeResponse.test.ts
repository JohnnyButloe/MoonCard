import { describe, expect, it } from "vitest";

import { normalizeMoonCardResponse } from "./normalizeResponse";
import {
  buildNormalizedMoonCardRequest,
  buildPythonMoonCardResponse,
} from "../../test/fixtures/mooncard";

describe("normalizeMoonCardResponse", () => {
  it("maps python data into stable canonical MoonCard fields", () => {
    const result = normalizeMoonCardResponse(
      buildPythonMoonCardResponse({
        meta: {
          calculation_source: "unexpected-source",
        },
      }),
      buildNormalizedMoonCardRequest(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected response normalization to succeed");
    }

    expect(Object.keys(result.value.meta).sort()).toEqual([
      "calculation_source",
      "data_version",
      "location",
      "requested_datetime",
      "timestamp_iso",
      "units",
    ]);
    expect(Object.keys(result.value.moon).sort()).toEqual([
      "altitude_deg",
      "azimuth_deg",
      "distance_km",
      "high_moon",
      "illumination_fraction",
      "illumination_percent",
      "is_up",
      "low_moon",
      "moonrise",
      "moonset",
      "path",
      "phase_angle_deg",
      "phase_name",
    ]);
    expect(result.value.meta.calculation_source).toBe("python_microservice");
    expect(result.value.meta.data_version).toBe("mooncard/v1");
    expect(result.value.meta.location.label).toBe("Testville");
    expect(result.value.twilight.current_phase).toBe("astronomical");
    expect(result.value.moon.path?.samples).toEqual([
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
    ]);
    expect(result.value.visibility.summary).toBe(
      "Astronomical twilight still supports darker-sky viewing.",
    );
  });

  it("keeps null-safe values and canonical error shapes stable for partial upstream data", () => {
    const result = normalizeMoonCardResponse(
      buildPythonMoonCardResponse({
        moon: {
          altitude_deg: "not-a-number",
          illumination_percent: "unknown",
          moonrise: 42,
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
                time_utc: "2026-04-05T01:00:00Z",
                time_local: "2026-04-05T01:00:00+00:00",
                altitude_deg: "high",
                azimuth_deg: 101.2,
                above_horizon: true,
              },
            ],
          },
        },
        sun: {
          sunrise: null,
        },
        twilight: {
          segments: [
            {
              phase: "astronomical",
              start_local: "2026-04-05T05:12:00Z",
              end_local: "2026-04-05T05:42:00Z",
            },
          ],
        },
        visibility: null,
        errors: [
          {
            type: "upstream",
            code: "upstream_timeout",
            message: "Timed out while fetching astronomy.",
            retryable: true,
            upstream_service: "python_microservice",
            upstream_status: 504,
            details: { source: "python" },
          },
        ],
      }),
      buildNormalizedMoonCardRequest(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected response normalization to succeed");
    }

    expect(result.value.moon.altitude_deg).toBeNull();
    expect(result.value.moon.illumination_percent).toBeNull();
    expect(result.value.moon.moonrise).toBeNull();
    expect(result.value.moon.path?.samples).toEqual([
      {
        time_utc: "2026-04-05T00:00:00Z",
        time_local: "2026-04-05T00:00:00+00:00",
        altitude_deg: -18.4,
        azimuth_deg: 91.2,
        above_horizon: false,
      },
    ]);
    expect(result.value.sun.sunrise).toBeNull();
    expect(result.value.twilight.segments).toEqual([
      {
        phase: "astronomical",
        start: "2026-04-05T05:12:00Z",
        end: "2026-04-05T05:42:00Z",
      },
    ]);
    expect(result.value.visibility).toEqual({
      is_dark_enough_for_viewing: true,
      summary: "Astronomical twilight still supports darker-sky viewing.",
    });
    expect(result.value.errors).toEqual([
      {
        type: "upstream",
        code: "upstream_timeout",
        message: "Timed out while fetching astronomy.",
        retryable: true,
        upstream_service: "python_microservice",
        upstream_status: 504,
        details: { source: "python" },
      },
    ]);
  });
});
