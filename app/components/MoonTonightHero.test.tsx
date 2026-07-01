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

import MoonTonightHero from "./MoonTonightHero";

describe("MoonTonightHero", () => {
  beforeEach(() => {
    mockUseMoonCard.mockReset();
    mockUseWeatherNow.mockReset();
  });

  it("keeps AM/PM on best viewing times and suppresses visible-now copy in bright daylight", () => {
    mockUseMoonCard.mockReturnValue(
      buildQueryResult({
        data: buildCanonicalMoonCardResponse({
          moon: {
            is_up: true,
            altitude_deg: 28,
            illumination_percent: 18,
          },
          sun: {
            is_up: true,
            altitude_deg: 35,
          },
          twilight: {
            current_phase: "day",
            nautical_dusk: "2026-04-05T20:12:00Z",
            next_transition: "2026-04-05T19:42:00Z",
          },
          visibility: {
            is_dark_enough_for_viewing: false,
            summary: "Daylight conditions are not dark enough for viewing.",
          },
        }),
      }),
    );
    mockUseWeatherNow.mockReturnValue(
      buildQueryResult({
        data: buildWeatherNow({
          condition: "clear",
          cloudCoverPct: 10,
        }),
      }),
    );

    render(<MoonTonightHero lat={40.7} lon={-74} tz="UTC" />);

    expect(screen.getByText("Best viewing tonight")).toBeInTheDocument();
    expect(screen.getByText("After 8:12 PM")).toBeInTheDocument();
    expect(screen.getByText("Daylight limited")).toBeInTheDocument();
    expect(screen.getByText("Not visible right now")).toBeInTheDocument();
    expect(
      screen.getByText("Above horizon, but daylight limits visibility."),
    ).toBeInTheDocument();
    expect(screen.queryByText("After 8:12")).not.toBeInTheDocument();
  });
});
