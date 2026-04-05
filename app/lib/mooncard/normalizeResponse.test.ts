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
      "phase_angle_deg",
      "phase_name",
    ]);
    expect(result.value.meta.calculation_source).toBe("python_microservice");
    expect(result.value.meta.data_version).toBe("mooncard/v1");
    expect(result.value.meta.location.label).toBe("Testville");
    expect(result.value.twilight.current_phase).toBe("astronomical");
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
