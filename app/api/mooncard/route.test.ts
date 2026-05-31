import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildMoonCardRequest,
  buildPythonMoonCardResponse,
} from "../../test/fixtures/mooncard";

const mockFetchMoonCardUpstream = vi.hoisted(() => vi.fn());

vi.mock("../../lib/mooncard/fetchMooncardUpstream", () => ({
  fetchMoonCardUpstream: mockFetchMoonCardUpstream,
}));

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/mooncard", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("/api/mooncard", () => {
  beforeEach(() => {
    mockFetchMoonCardUpstream.mockReset();
  });

  it("returns a canonical success response for a valid request", async () => {
    mockFetchMoonCardUpstream.mockResolvedValue({
      ok: true,
      data: buildPythonMoonCardResponse(),
    });

    const response = await POST(
      makeRequest(
        buildMoonCardRequest({
          location: {
            label: "  Testville  ",
          },
        }),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.meta.location.label).toBe("Testville");
    expect(body.data.meta.calculation_source).toBe("python_microservice");
    expect(body.data.moon.phase_name).toBe("Waxing Gibbous");
    expect(body.data.moon.path?.sample_count).toBe(220);
    expect(body.data.moon.path?.samples[1]).toMatchObject({
      time_utc: "2026-04-05T06:30:00Z",
      altitude_deg: 32.4,
      azimuth_deg: 143.2,
      above_horizon: true,
    });
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(mockFetchMoonCardUpstream).toHaveBeenCalledWith(
      expect.objectContaining({
        pythonPayload: expect.objectContaining({
          label: "Testville",
        }),
      }),
      expect.objectContaining({
        requestId: expect.any(String),
      }),
    );
  });

  it("returns canonical validation errors for invalid requests", async () => {
    const response = await POST(
      makeRequest(
        buildMoonCardRequest({
          location: {
            lat: 181,
          },
        }),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      ok: false,
      data: null,
      errors: [
        {
          type: "validation",
          code: "invalid_location",
          field: "location.lat",
        },
      ],
    });
    expect(mockFetchMoonCardUpstream).not.toHaveBeenCalled();
  });

  it("maps upstream timeouts into canonical product-facing errors", async () => {
    mockFetchMoonCardUpstream.mockResolvedValue({
      ok: false,
      kind: "timeout",
      message: "aborted",
      upstream_status: null,
      details: {
        error: "aborted",
      },
    });

    const response = await POST(makeRequest(buildMoonCardRequest()));
    const body = await response.json();

    expect(response.status).toBe(504);
    expect(body).toEqual({
      ok: false,
      data: null,
      errors: [
        {
          type: "upstream",
          code: "upstream_timeout",
          message:
            "The Python microservice timed out before returning MoonCard data.",
          retryable: true,
          upstream_service: "python_microservice",
          upstream_status: null,
          details: {
            error: "aborted",
          },
        },
      ],
    });
  });

  it("maps upstream failures into canonical unavailable errors", async () => {
    mockFetchMoonCardUpstream.mockResolvedValue({
      ok: false,
      kind: "bad_response",
      message: "The Python microservice returned a non-success response.",
      upstream_status: 502,
      details: {
        status: 502,
      },
    });

    const response = await POST(makeRequest(buildMoonCardRequest()));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.errors[0]).toMatchObject({
      type: "upstream",
      code: "upstream_unavailable",
      retryable: true,
      upstream_service: "python_microservice",
      upstream_status: 502,
    });
  });

  it("keeps partial upstream data null-safe in the canonical response", async () => {
    mockFetchMoonCardUpstream.mockResolvedValue({
      ok: true,
      data: buildPythonMoonCardResponse({
        moon: {
          altitude_deg: "high",
          azimuth_deg: null,
          illumination_percent: "unknown",
          moonrise: 9,
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
                azimuth_deg: 95.1,
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
    });

    const response = await POST(makeRequest(buildMoonCardRequest()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.moon.altitude_deg).toBeNull();
    expect(body.data.moon.azimuth_deg).toBeNull();
    expect(body.data.moon.illumination_percent).toBeNull();
    expect(body.data.moon.moonrise).toBeNull();
    expect(body.data.moon.path.samples).toEqual([
      {
        time_utc: "2026-04-05T00:00:00Z",
        time_local: "2026-04-05T00:00:00+00:00",
        altitude_deg: -18.4,
        azimuth_deg: 91.2,
        above_horizon: false,
      },
    ]);
    expect(body.data.sun.sunrise).toBeNull();
    expect(body.data.twilight.segments).toEqual([
      {
        phase: "astronomical",
        start: "2026-04-05T05:12:00Z",
        end: "2026-04-05T05:42:00Z",
      },
    ]);
    expect(body.data.errors[0]).toMatchObject({
      type: "upstream",
      code: "upstream_timeout",
      upstream_service: "python_microservice",
      upstream_status: 504,
    });
  });
});
