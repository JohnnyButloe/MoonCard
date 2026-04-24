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
  buildCyclePosition,
  buildOrbitCurveY,
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

  it("renders the timeline with sunrise and sunset details", () => {
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
    expect(screen.getByText("Sunrise")).toBeInTheDocument();
    expect(screen.getAllByText("6:42 AM")).toHaveLength(2);
    expect(screen.getByText("Sunset")).toBeInTheDocument();
    expect(screen.getByText("7:15 PM")).toBeInTheDocument();
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

  it("renders partial timeline data null-safely", () => {
    mockUseMoonCard.mockReturnValue(
      buildQueryResult({
        data: buildCanonicalMoonCardResponse({
          sun: {
            sunrise: null,
            sunset: null,
          },
          twilight: {
            segments: [],
          },
        }),
      }),
    );

    render(<MoonAltitudeGraph lat={40.7} lon={-74} tz="UTC" />);

    expect(
      screen.getByText("Timeline is using partial astronomy data."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("maps orbit timing onto the real day so rise and set still hit the horizon", () => {
    const summary = buildCanonicalMoonCardResponse();
    const dayStartMs = Date.parse("2026-04-05T00:00:00Z");
    const dayEndMs = Date.parse("2026-04-06T00:00:00Z");
    const sunriseMs = Date.parse("2026-04-05T06:42:00Z");
    const sunsetMs = Date.parse("2026-04-05T19:15:00Z");
    const risePhase = buildCyclePosition({
      nowMs: sunriseMs,
      dayStartMs,
      dayEndMs,
      riseMs: sunriseMs,
      setMs: sunsetMs,
      isUp: summary.sun.is_up,
    });
    const setPhase = buildCyclePosition({
      nowMs: sunsetMs,
      dayStartMs,
      dayEndMs,
      riseMs: sunriseMs,
      setMs: sunsetMs,
      isUp: summary.sun.is_up,
    });
    const middayY = buildOrbitCurveY({
      nowMs: Date.parse("2026-04-05T12:00:00Z"),
      dayStartMs,
      dayEndMs,
      riseMs: sunriseMs,
      setMs: sunsetMs,
      isUp: summary.sun.is_up,
    });
    const sunriseY = buildOrbitCurveY({
      nowMs: sunriseMs,
      dayStartMs,
      dayEndMs,
      riseMs: sunriseMs,
      setMs: sunsetMs,
      isUp: summary.sun.is_up,
    });
    const sunsetY = buildOrbitCurveY({
      nowMs: sunsetMs,
      dayStartMs,
      dayEndMs,
      riseMs: sunriseMs,
      setMs: sunsetMs,
      isUp: summary.sun.is_up,
    });

    expect(risePhase).toBeCloseTo(0.25, 5);
    expect(setPhase).toBeCloseTo(0.75, 5);
    expect(sunriseY).toBeCloseTo(21, 5);
    expect(sunsetY).toBeCloseTo(21, 5);
    expect(middayY).toBeLessThan(21);
  });

  it("supports wrap-around moon timing when moonset happens before moonrise", () => {
    const dayStartMs = Date.parse("2026-04-05T00:00:00Z");
    const dayEndMs = Date.parse("2026-04-06T00:00:00Z");
    const moonsetMs = Date.parse("2026-04-05T06:00:00Z");
    const moonriseMs = Date.parse("2026-04-05T18:00:00Z");

    const morningPhase = buildCyclePosition({
      nowMs: Date.parse("2026-04-05T03:00:00Z"),
      dayStartMs,
      dayEndMs,
      riseMs: moonriseMs,
      setMs: moonsetMs,
      isUp: true,
    });
    const daytimePhase = buildCyclePosition({
      nowMs: Date.parse("2026-04-05T12:00:00Z"),
      dayStartMs,
      dayEndMs,
      riseMs: moonriseMs,
      setMs: moonsetMs,
      isUp: false,
    });
    const eveningPhase = buildCyclePosition({
      nowMs: Date.parse("2026-04-05T21:00:00Z"),
      dayStartMs,
      dayEndMs,
      riseMs: moonriseMs,
      setMs: moonsetMs,
      isUp: true,
    });

    expect(morningPhase).toBeGreaterThan(0.5);
    expect(morningPhase).toBeLessThan(0.75);
    expect(daytimePhase).toBeGreaterThan(0.75);
    expect(eveningPhase).toBeGreaterThan(0.25);
    expect(eveningPhase).toBeLessThan(0.5);
  });
});
