// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
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
  buildMoonHoverTooltipLayout,
  buildMoonVisualOrbitPath,
  buildMoonAltitudeScale,
  buildOrbitCurveY,
  findNearestMoonSampleByMs,
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

  it("renders the chart chrome with the twilight badge, object legend, and twilight windows", () => {
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
    expect(screen.getByText("Moon now")).toBeInTheDocument();
    expect(screen.getByText("Sun now")).toBeInTheDocument();
    expect(screen.getByText("Horizon")).toBeInTheDocument();
    expect(screen.getByTestId("below-horizon-band")).toBeInTheDocument();
    expect(screen.getByTestId("below-horizon-haze")).toBeInTheDocument();
    expect(screen.getByTestId("below-horizon-depth-shadow")).toBeInTheDocument();
    expect(screen.getByTestId("below-horizon-limb-shadow")).toBeInTheDocument();
    expect(screen.queryByTestId("below-horizon-earth-map")).not.toBeInTheDocument();
    expect(screen.queryByTestId("below-horizon-earth-grid")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("below-horizon-earth-silhouettes"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("horizon-glow-line")).toBeInTheDocument();
    expect(screen.getByTestId("horizon-line")).toBeInTheDocument();
    expect(screen.queryByTestId("below-horizon-label")).not.toBeInTheDocument();
    expect(screen.getAllByText("Sunrise")).toHaveLength(4);
    expect(screen.getByText("6:42 AM")).toBeInTheDocument();
    expect(screen.getAllByText("Sunset")).toHaveLength(4);
    expect(screen.getByText("7:15 PM")).toBeInTheDocument();
    expect(screen.getByText("Twilight windows")).toBeInTheDocument();
    expect(screen.getByText("Civil twilight")).toBeInTheDocument();
    expect(screen.getByText("6:15 AM - 6:42 AM")).toBeInTheDocument();
    expect(screen.getByText("7:15 PM - 7:42 PM")).toBeInTheDocument();
    expect(screen.getByText("Bright twilight")).toBeInTheDocument();
    expect(screen.getByText("Nautical twilight")).toBeInTheDocument();
    expect(screen.getByText("5:42 AM - 6:15 AM")).toBeInTheDocument();
    expect(screen.getByText("7:42 PM - 8:12 PM")).toBeInTheDocument();
    expect(screen.getByText("Darker sky")).toBeInTheDocument();
    expect(screen.getByText("Astronomical twilight")).toBeInTheDocument();
    expect(screen.getByText("5:12 AM - 5:42 AM")).toBeInTheDocument();
    expect(screen.getByText("8:12 PM - 8:42 PM")).toBeInTheDocument();
    expect(screen.getByText("Best dark-sky window")).toBeInTheDocument();
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

  it("finds the nearest real Moon sample by timestamp for hover lookup", () => {
    const dayStartMs = Date.parse("2026-04-05T00:00:00Z");
    const dayEndMs = Date.parse("2026-04-06T00:00:00Z");
    const points = buildAltitudePlotPoints({
      dayStartMs,
      dayEndMs,
      samples: [
        {
          time_utc: "2026-04-05T00:00:00Z",
          altitude_deg: -18.4,
          azimuth_deg: 91.2,
          above_horizon: false,
        },
        {
          time_utc: "2026-04-05T06:30:00Z",
          altitude_deg: 32.4,
          azimuth_deg: 143.2,
          above_horizon: true,
        },
        {
          time_utc: "2026-04-06T00:00:00Z",
          altitude_deg: -27.6,
          azimuth_deg: 287.1,
          above_horizon: false,
        },
      ],
    });

    const nearest = findNearestMoonSampleByMs(
      points,
      Date.parse("2026-04-05T05:10:00Z"),
    );

    expect(nearest).toMatchObject({
      ms: Date.parse("2026-04-05T06:30:00Z"),
      altitudeDeg: 32.4,
      azimuthDeg: 143.2,
      aboveHorizon: true,
    });
  });

  it("builds a bounded hover tooltip layout near the chart edges", () => {
    expect(
      buildMoonHoverTooltipLayout({
        hoverX: 2,
        hoverY: 4,
      }),
    ).toMatchObject({
      horizontalAlign: "start",
      verticalAlign: "bottom",
    });
    expect(
      buildMoonHoverTooltipLayout({
        hoverX: 2,
        hoverY: 4,
      }).leftPct,
    ).toBeGreaterThanOrEqual(4);

    expect(
      buildMoonHoverTooltipLayout({
        hoverX: 158,
        hoverY: 30,
      }),
    ).toMatchObject({
      horizontalAlign: "end",
      verticalAlign: "top",
    });
    expect(
      buildMoonHoverTooltipLayout({
        hoverX: 80,
        hoverY: 18,
      }),
    ).toMatchObject({
      horizontalAlign: "center",
      verticalAlign: "top",
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

  it("shows hover tooltip data from the nearest real Moon sample while keeping the marker on the sampled moon path", () => {
    const data = buildCanonicalMoonCardResponse();
    mockUseMoonCard.mockReturnValue(
      buildQueryResult({
        data,
      }),
    );

    render(<MoonAltitudeGraph lat={40.7} lon={-74} tz="UTC" />);

    const svg = screen.getByTestId("moon-graph-svg");
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 160,
      bottom: 36,
      width: 160,
      height: 36,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.pointerMove(svg, { clientX: 1, clientY: 18 });

    expect(screen.getByTestId("moon-hover-tooltip")).toBeInTheDocument();
    expect(screen.getByTestId("moon-hover-guide")).toBeInTheDocument();
    expect(screen.getByText("Time")).toBeInTheDocument();
    expect(screen.getByText("12:00 AM")).toBeInTheDocument();
    expect(screen.getByText("Moon altitude")).toBeInTheDocument();
    expect(screen.getByText("-18°")).toBeInTheDocument();
    expect(screen.getByText("Direction")).toBeInTheDocument();
    expect(screen.getByText("E / 91°")).toBeInTheDocument();
    expect(screen.getByTestId("moon-hover-tooltip")).toHaveTextContent(
      "Below horizon",
    );

    const points = buildAltitudePlotPoints({
      dayStartMs: Date.parse("2026-04-05T00:00:00Z"),
      dayEndMs: Date.parse("2026-04-06T00:00:00Z"),
      samples: data.moon.path?.samples,
    });
    const hoveredPoint = points[0];
    const hoverMarker = screen.getByTestId("moon-hover-marker");
    const hoverMarkerY = Number(hoverMarker.getAttribute("cy"));

    expect(hoverMarkerY).toBeCloseTo(hoveredPoint.y, 4);

    fireEvent.pointerLeave(svg);

    expect(screen.queryByTestId("moon-hover-tooltip")).not.toBeInTheDocument();
    expect(screen.queryByTestId("moon-hover-marker")).not.toBeInTheDocument();
  });

  it("supports tap-style pointer interaction for showing the Moon tooltip", () => {
    mockUseMoonCard.mockReturnValue(
      buildQueryResult({
        data: buildCanonicalMoonCardResponse(),
      }),
    );

    render(<MoonAltitudeGraph lat={40.7} lon={-74} tz="UTC" />);

    const svg = screen.getByTestId("moon-graph-svg");
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 160,
      bottom: 36,
      width: 160,
      height: 36,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.pointerDown(svg, {
      clientX: 90,
      clientY: 14,
      pointerType: "touch",
    });

    expect(screen.getByTestId("moon-hover-tooltip")).toBeInTheDocument();
    expect(screen.getByTestId("moon-hover-marker")).toBeInTheDocument();
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

  it("does not show a Moon hover tooltip when real Moon samples are unavailable", () => {
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

    const svg = screen.getByTestId("moon-graph-svg");
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 160,
      bottom: 36,
      width: 160,
      height: 36,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.pointerMove(svg, { clientX: 40, clientY: 18 });

    expect(screen.queryByTestId("moon-hover-tooltip")).not.toBeInTheDocument();
    expect(screen.queryByTestId("moon-hover-marker")).not.toBeInTheDocument();
  });
});
