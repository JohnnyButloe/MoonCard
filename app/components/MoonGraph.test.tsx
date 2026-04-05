// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildCanonicalMoonCardResponse,
  buildQueryResult,
} from "../test/fixtures/mooncard";

const mockUseMoonCard = vi.hoisted(() => vi.fn());

vi.mock("../hooks/useAstronomy", () => ({
  useMoonCard: mockUseMoonCard,
}));

import MoonAltitudeGraph from "./MoonGraph";

describe("MoonGraph", () => {
  beforeEach(() => {
    mockUseMoonCard.mockReset();
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
});
