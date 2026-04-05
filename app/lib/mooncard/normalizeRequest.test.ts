import { describe, expect, it } from "vitest";

import { normalizeMoonCardRequest } from "./normalizeRequest";
import { buildMoonCardRequest } from "../../test/fixtures/mooncard";

describe("normalizeMoonCardRequest", () => {
  it("normalizes a valid request into the canonical python payload", () => {
    const result = normalizeMoonCardRequest(
      buildMoonCardRequest({
        location: {
          label: "  Testville  ",
        },
        datetime: {
          date: "2026-04-05",
          time: "02:30",
          timezone: "America/New_York",
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected request normalization to succeed");
    }

    expect(result.value.requestOrigin).toBe("dashboard");
    expect(result.value.pythonPayload).toMatchObject({
      lat: 40.7128,
      lon: -74.006,
      label: "Testville",
      timezone: "America/New_York",
      local_date: "2026-04-05",
      local_time: "02:30",
      timestamp_iso: "2026-04-05T06:30:00Z",
      include_sun: true,
      include_moon: true,
      include_twilight: true,
      include_visibility: true,
    });
  });

  it("returns canonical validation errors for invalid datetime input", () => {
    const result = normalizeMoonCardRequest(
      buildMoonCardRequest({
        datetime: {
          date: "2026-02-30",
          time: "25:61",
          timezone: "Mars/Olympus_Mons",
        },
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected request normalization to fail");
    }

    expect(result.errors).toEqual([
      expect.objectContaining({
        type: "validation",
        code: "invalid_datetime",
        field: "datetime.date",
      }),
      expect.objectContaining({
        type: "validation",
        code: "invalid_datetime",
        field: "datetime.time",
      }),
      expect.objectContaining({
        type: "validation",
        code: "invalid_datetime",
        field: "datetime.timezone",
      }),
    ]);
  });
});
