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

import MoonSkySummaryBanner from "./MoonSkySummaryBanner";

describe("MoonSkySummaryBanner", () => {
  beforeEach(() => {
    mockUseMoonCard.mockReset();
    mockUseWeatherNow.mockReset();
  });

  it("renders the generated summary from dashboard data", () => {
    mockUseMoonCard.mockReturnValue(
      buildQueryResult({
        data: buildCanonicalMoonCardResponse(),
      }),
    );
    mockUseWeatherNow.mockReturnValue(
      buildQueryResult({
        data: buildWeatherNow(),
      }),
    );

    render(<MoonSkySummaryBanner lat={40.7} lon={-74} tz="UTC" />);

    expect(screen.getByText("Today's sky conditions")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Moon rises at 1:15 AM and sets at 1:45 PM. Mostly clear skies tonight with good viewing as it reaches peak altitude around 7:20 AM.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the neutral cached-data note when a source refresh fails", () => {
    mockUseMoonCard.mockReturnValue(
      buildQueryResult({
        data: buildCanonicalMoonCardResponse(),
        error: new Error("summary-refresh-failed"),
      }),
    );
    mockUseWeatherNow.mockReturnValue(
      buildQueryResult({
        data: buildWeatherNow(),
      }),
    );

    render(<MoonSkySummaryBanner lat={40.7} lon={-74} tz="UTC" />);

    expect(
      screen.getByText("Sky summary is showing the latest available data."),
    ).toBeInTheDocument();
  });

  it("adds a nautical twilight viewing suggestion when daylight is too bright", () => {
    mockUseMoonCard.mockReturnValue(
      buildQueryResult({
        data: buildCanonicalMoonCardResponse({
          sun: {
            is_up: true,
          },
          visibility: {
            is_dark_enough_for_viewing: false,
            summary: "Daylight conditions are not dark enough for viewing.",
          },
          twilight: {
            nautical_dusk: "2026-04-05T20:12:00Z",
          },
        }),
      }),
    );
    mockUseWeatherNow.mockReturnValue(
      buildQueryResult({
        data: buildWeatherNow(),
      }),
    );

    render(<MoonSkySummaryBanner lat={40.7} lon={-74} tz="UTC" />);

    expect(
      screen.getByText(
        "Moon rises at 1:15 AM and sets at 1:45 PM. Mostly clear skies today, but Daylight conditions are not dark enough for viewing. Moon should be visible around nautical twilight at 8:12 PM.",
      ),
    ).toBeInTheDocument();
  });
});
