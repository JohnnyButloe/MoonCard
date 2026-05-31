// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildCanonicalMoonCardResponse,
  buildQueryResult,
  buildWeatherNow,
} from "../test/fixtures/mooncard";

const mockUseMoonCard = vi.hoisted(() => vi.fn());
const mockUseWeatherNow = vi.hoisted(() => vi.fn());

vi.mock("../hooks/useAstronomy", () => ({
  useMoonCard: mockUseMoonCard,
}));

vi.mock("../hooks/useWeather", () => ({
  useWeatherNow: mockUseWeatherNow,
}));

import MoonAltitudeGraph, {
  buildAltitudePlotPoints,
  buildMoonVisualOrbitPath,
  buildMoonAltitudeScale,
  buildOrbitCurveY,
  getMoonVisualYForMs,
  interpolatePlotPointAtMs,
} from "./MoonGraph";

describe("MoonGraph", () => {
  beforeEach(() => {
    mockUseMoonCard.mockReset();
    mockUseWeatherNow.mockReset();
    mockUseWeatherNow.mockReturnValue(
      buildQueryResult({
        data: buildWeatherNow(),
      }),
    );
  });

  it("renders a stable loading state", () => {
    mockUseMoonCard.mockReturnValue(buildQueryResult({ isLoading: true }));

    render(<MoonAltitudeGraph lat={40.7} lon={-74} tz="UTC" />);

    expect(
      screen.getByText("Loading the astronomy timeline. This can take a moment."),
    ).toBeInTheDocument();
  });

  it("renders the chart chrome with the twilight badge and updated label", () => {
    mockUseMoonCard.mockReturnValue(
      buildQueryResult({
        data: buildCanonicalMoonCardResponse(),
        dataUpdatedAt: Date.parse("2026-04-05T06:35:00Z"),
      }),
    );

    render(<MoonAltitudeGraph lat={40.7} lon={-74} tz="UTC" />);

    expect(screen.getByText("Moon/Sun altitude")).toBeInTheDocument();
    expect(screen.getByText("Twilight Astronomical")).toBeInTheDocument();
    expect(screen.getByText("Updated 6:35 AM")).toBeInTheDocument();
  });

  it("keeps rendering cached data when the timeline refresh fails", () => {
    mockUseMoonCard.mockReturnValue(
      buildQueryResult({
        data: buildCanonicalMoonCardResponse(),
        error: new Error("mooncard-refresh-failed"),
      }),
    );

    render(<MoonAltitudeGraph lat={40.7} lon={-74} tz="UTC" />);

    expect(
      screen.getByText("Timeline refresh failed. Showing the last update."),
    ).toBeInTheDocument();
    expect(screen.getByText("Moon/Sun altitude")).toBeInTheDocument();
  });

  it("renders partial timeline data null-safely when Moon samples are missing", () => {
    mockUseMoonCard.mockReturnValue(
      buildQueryResult({
        data: buildCanonicalMoonCardResponse({
          moon: {
            path: null,
          },
        }),
      }),
    );

    render(<MoonAltitudeGraph lat={40.7} lon={-74} tz="UTC" />);

    expect(
      screen.getByText("Timeline is using partial astronomy data."),
    ).toBeInTheDocument();
    expect(screen.getByText("Moon/Sun altitude")).toBeInTheDocument();
  });

  it("maps real Moon samples onto the chart time and horizon scale in sorted order", () => {
    const dayStartMs = Date.parse("2026-04-05T00:00:00Z");
    const dayEndMs = Date.parse("2026-04-06T00:00:00Z");
    const points = buildAltitudePlotPoints({
      dayStartMs,
      dayEndMs,
      samples: [
        {
          time_utc: "2026-04-05T12:00:00Z",
          altitude_deg: 43,
          azimuth_deg: 180,
          above_horizon: true,
        },
        {
          time_utc: "2026-04-05T00:00:00Z",
          altitude_deg: -12,
          azimuth_deg: 90,
          above_horizon: false,
        },
        {
          time_utc: "2026-04-05T06:00:00Z",
          altitude_deg: 0,
          azimuth_deg: 110,
          above_horizon: true,
        },
      ],
    });

    expect(points.map((point) => point.ms)).toEqual([
      Date.parse("2026-04-05T00:00:00Z"),
      Date.parse("2026-04-05T06:00:00Z"),
      Date.parse("2026-04-05T12:00:00Z"),
    ]);
    expect(points[0]?.y).toBeGreaterThan(21);
    expect(points[1]?.y).toBeCloseTo(21, 5);
    expect(points[2]?.y).toBeLessThan(21);
  });

  it("keeps real Moon samples parsed for future hover lookup", () => {
    const dayStartMs = Date.parse("2026-04-05T00:00:00Z");
    const dayEndMs = Date.parse("2026-04-06T00:00:00Z");
    const points = buildAltitudePlotPoints({
      dayStartMs,
      dayEndMs,
      samples: [
        {
          time_utc: "2026-04-05T00:00:00Z",
          altitude_deg: -18,
          azimuth_deg: 90,
          above_horizon: false,
        },
        {
          time_utc: "2026-04-05T12:00:00Z",
          altitude_deg: 18,
          azimuth_deg: 180,
          above_horizon: true,
        },
      ],
    });
    const marker = interpolatePlotPointAtMs(
      points,
      Date.parse("2026-04-05T06:00:00Z"),
    );

    expect(marker).not.toBeNull();
    expect(marker?.x).toBeCloseTo((points[0].x + points[1].x) / 2, 5);
    expect(marker?.y).toBeCloseTo((points[0].y + points[1].y) / 2, 5);
    expect(points[0]).toMatchObject({
      altitudeDeg: -18,
      azimuthDeg: 90,
      aboveHorizon: false,
    });
    expect(points[1]).toMatchObject({
      altitudeDeg: 18,
      azimuthDeg: 180,
      aboveHorizon: true,
    });
  });

  it("builds a Moon visual curve that crosses the horizon at moonrise and moonset", () => {
    const dayStartMs = Date.parse("2026-04-05T00:00:00Z");
    const dayEndMs = Date.parse("2026-04-06T00:00:00Z");
    const riseMs = Date.parse("2026-04-05T02:00:00Z");
    const setMs = Date.parse("2026-04-05T14:00:00Z");

    expect(
      getMoonVisualYForMs({
        targetMs: riseMs,
        dayStartMs,
        dayEndMs,
        riseMs,
        setMs,
        peakMs: null,
        isUp: false,
      }),
    ).toBeCloseTo(21, 5);
    expect(
      getMoonVisualYForMs({
        targetMs: setMs,
        dayStartMs,
        dayEndMs,
        riseMs,
        setMs,
        peakMs: null,
        isUp: false,
      }),
    ).toBeCloseTo(21, 5);
  });

  it("keeps the Moon visual curve above the horizon between rise and set", () => {
    const dayStartMs = Date.parse("2026-04-05T00:00:00Z");
    const dayEndMs = Date.parse("2026-04-06T00:00:00Z");
    const riseMs = Date.parse("2026-04-05T02:00:00Z");
    const setMs = Date.parse("2026-04-05T14:00:00Z");
    const midArcY = getMoonVisualYForMs({
      targetMs: Date.parse("2026-04-05T08:00:00Z"),
      dayStartMs,
      dayEndMs,
      riseMs,
      setMs,
      peakMs: null,
      isUp: true,
    });

    expect(midArcY).toBeLessThan(21);
  });

  it("biases the Moon visual arc upward near high moon when that time is available", () => {
    const dayStartMs = Date.parse("2026-04-05T00:00:00Z");
    const dayEndMs = Date.parse("2026-04-06T00:00:00Z");
    const riseMs = Date.parse("2026-04-05T02:00:00Z");
    const setMs = Date.parse("2026-04-05T14:00:00Z");
    const highMoonMs = Date.parse("2026-04-05T07:00:00Z");
    const nearHighMoonY = getMoonVisualYForMs({
      targetMs: highMoonMs,
      dayStartMs,
      dayEndMs,
      riseMs,
      setMs,
      peakMs: highMoonMs,
      isUp: true,
    });
    const lateArcY = getMoonVisualYForMs({
      targetMs: Date.parse("2026-04-05T11:00:00Z"),
      dayStartMs,
      dayEndMs,
      riseMs,
      setMs,
      peakMs: highMoonMs,
      isUp: true,
    });

    expect(nearHighMoonY).toBeLessThan(lateArcY);
    expect(nearHighMoonY).toBeLessThan(21);
  });

  it("falls back to a midpoint peak when high moon is missing", () => {
    const dayStartMs = Date.parse("2026-04-05T00:00:00Z");
    const dayEndMs = Date.parse("2026-04-06T00:00:00Z");
    const riseMs = Date.parse("2026-04-05T02:00:00Z");
    const setMs = Date.parse("2026-04-05T14:00:00Z");
    const midpointMs = riseMs + (setMs - riseMs) / 2;
    const midpointY = getMoonVisualYForMs({
      targetMs: midpointMs,
      dayStartMs,
      dayEndMs,
      riseMs,
      setMs,
      peakMs: null,
      isUp: true,
    });
    const shoulderY = getMoonVisualYForMs({
      targetMs: Date.parse("2026-04-05T05:00:00Z"),
      dayStartMs,
      dayEndMs,
      riseMs,
      setMs,
      peakMs: null,
      isUp: true,
    });

    expect(midpointY).toBeLessThan(shoulderY);
    expect(midpointY).toBeLessThan(21);
  });

  it("uses the same Moon visual y function for the marker as for the rendered path", () => {
    const dayStartMs = Date.parse("2026-04-05T00:00:00Z");
    const dayEndMs = Date.parse("2026-04-06T00:00:00Z");
    const riseMs = Date.parse("2026-04-05T02:00:00Z");
    const setMs = Date.parse("2026-04-05T14:00:00Z");
    const targetMs = Date.parse("2026-04-05T09:00:00Z");
    const expectedY = getMoonVisualYForMs({
      targetMs,
      dayStartMs,
      dayEndMs,
      riseMs,
      setMs,
      peakMs: Date.parse("2026-04-05T08:00:00Z"),
      isUp: true,
    });
    const path = buildMoonVisualOrbitPath({
      dayStartMs,
      dayEndMs,
      riseMs,
      setMs,
      peakMs: Date.parse("2026-04-05T08:00:00Z"),
      isUp: true,
      samples: 220,
    });
    const targetX = ((targetMs - dayStartMs) / (dayEndMs - dayStartMs)) * 160;
    const pathPoint = path
      .split("L ")
      .map((segment) => segment.replace(/^M /, "").trim())
      .map((segment) => segment.split(",").map(Number))
      .find(([x]) => Math.abs(x - targetX) < 0.5);

    expect(pathPoint).toBeDefined();
    expect(Math.abs((pathPoint?.[1] ?? 0) - expectedY)).toBeLessThan(0.1);
  });

  it("keeps the synthetic Sun orbit helper aligned to the horizon at rise and set", () => {
    const dayStartMs = Date.parse("2026-04-05T00:00:00Z");
    const dayEndMs = Date.parse("2026-04-06T00:00:00Z");
    const middayY = buildOrbitCurveY({
      nowMs: Date.parse("2026-04-05T12:00:00Z"),
      dayStartMs,
      dayEndMs,
      riseMs: Date.parse("2026-04-05T06:42:00Z"),
      setMs: Date.parse("2026-04-05T19:15:00Z"),
      isUp: false,
    });
    const sunriseY = buildOrbitCurveY({
      nowMs: Date.parse("2026-04-05T06:42:00Z"),
      dayStartMs,
      dayEndMs,
      riseMs: Date.parse("2026-04-05T06:42:00Z"),
      setMs: Date.parse("2026-04-05T19:15:00Z"),
      isUp: false,
    });
    const sunsetY = buildOrbitCurveY({
      nowMs: Date.parse("2026-04-05T19:15:00Z"),
      dayStartMs,
      dayEndMs,
      riseMs: Date.parse("2026-04-05T06:42:00Z"),
      setMs: Date.parse("2026-04-05T19:15:00Z"),
      isUp: false,
    });

    expect(sunriseY).toBeCloseTo(21, 5);
    expect(sunsetY).toBeCloseTo(21, 5);
    expect(middayY).toBeLessThan(21);
  });

  it("keeps the altitude scale horizon-aware for above- and below-horizon values", () => {
    const moonAltitudeToY = buildMoonAltitudeScale([
      {
        time_utc: "2026-04-05T00:00:00Z",
        altitude_deg: -5,
        azimuth_deg: 90,
        above_horizon: false,
      },
      {
        time_utc: "2026-04-05T06:00:00Z",
        altitude_deg: -25,
        azimuth_deg: 100,
        above_horizon: false,
      },
      {
        time_utc: "2026-04-05T12:00:00Z",
        altitude_deg: 35,
        azimuth_deg: 180,
        above_horizon: true,
      },
    ]);

    expect(moonAltitudeToY(0)).toBeCloseTo(21, 5);
    expect(moonAltitudeToY(35)).toBeLessThan(21);
    expect(moonAltitudeToY(-5)).toBeGreaterThan(21);
    expect(moonAltitudeToY(-25)).toBeGreaterThan(moonAltitudeToY(-5));
    expect(moonAltitudeToY(-25)).toBeLessThan(36);
  });

  it("keeps deep negative Moon samples visually distinct instead of flattening them", () => {
    const dayStartMs = Date.parse("2026-04-05T00:00:00Z");
    const dayEndMs = Date.parse("2026-04-06T00:00:00Z");
    const points = buildAltitudePlotPoints({
      dayStartMs,
      dayEndMs,
      samples: [
        {
          time_utc: "2026-04-05T00:00:00Z",
          altitude_deg: -5,
          azimuth_deg: 90,
          above_horizon: false,
        },
        {
          time_utc: "2026-04-05T06:00:00Z",
          altitude_deg: -25,
          azimuth_deg: 100,
          above_horizon: false,
        },
        {
          time_utc: "2026-04-05T12:00:00Z",
          altitude_deg: 35,
          azimuth_deg: 180,
          above_horizon: true,
        },
      ],
    });

    expect(points[0]?.y).toBeGreaterThan(21);
    expect(points[1]?.y).toBeGreaterThan(points[0]?.y);
    expect(points[1]?.y).toBeLessThan(36);
    expect(points[2]?.y).toBeLessThan(21);
  });
});
