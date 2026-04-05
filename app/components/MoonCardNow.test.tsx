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

import MoonNowCard from "./MoonCardNow";

describe("MoonCardNow", () => {
  beforeEach(() => {
    mockUseMoonCard.mockReset();
    mockUseWeatherNow.mockReset();
  });

  it("renders a stable loading state", () => {
    mockUseMoonCard.mockReturnValue(buildQueryResult({ isLoading: true }));
    mockUseWeatherNow.mockReturnValue(buildQueryResult({ isLoading: true }));

    render(<MoonNowCard lat={40.7} lon={-74} tz="UTC" />);

    expect(
      screen.getByText("Loading moon data. This can take a moment."),
    ).toBeInTheDocument();
  });

  it("renders the full moon summary with weather details", () => {
    mockUseMoonCard.mockReturnValue(
      buildQueryResult({
        data: buildCanonicalMoonCardResponse(),
        dataUpdatedAt: Date.parse("2026-04-05T06:35:00Z"),
      }),
    );
    mockUseWeatherNow.mockReturnValue(
      buildQueryResult({
        data: buildWeatherNow(),
      }),
    );

    render(<MoonNowCard lat={40.7} lon={-74} tz="UTC" />);

    expect(screen.getByText("Moon now")).toBeInTheDocument();
    expect(screen.getByText("74%")).toBeInTheDocument();
    expect(screen.getByText("Waxing Gibbous")).toBeInTheDocument();
    expect(screen.getByText("Clear")).toBeInTheDocument();
    expect(screen.getByText("18% cloud")).toBeInTheDocument();
    expect(screen.getByText("Moonrise (East)")).toBeInTheDocument();
    expect(screen.getByText("Updated 6:35 AM UTC")).toBeInTheDocument();
  });

  it("renders degraded astronomy and unavailable weather states without breaking the card", () => {
    mockUseMoonCard.mockReturnValue(
      buildQueryResult({
        data: buildCanonicalMoonCardResponse({
          moon: {
            phase_name: null,
            altitude_deg: null,
            azimuth_deg: null,
          },
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
      }),
    );
    mockUseWeatherNow.mockReturnValue(
      buildQueryResult({
        error: new Error("weather-now-failed"),
      }),
    );

    render(<MoonNowCard lat={40.7} lon={-74} tz="UTC" />);

    expect(
      screen.getByText("Astronomy data is degraded. Some details may be limited."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Weather is unavailable. Lunar data is still live."),
    ).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getByText("Moonrise (East)")).toBeInTheDocument();
  });

  it("renders the error shell when moon data is unavailable", () => {
    mockUseMoonCard.mockReturnValue(
      buildQueryResult({
        error: new Error("mooncard-route-failed"),
      }),
    );
    mockUseWeatherNow.mockReturnValue(buildQueryResult({}));

    render(<MoonNowCard lat={40.7} lon={-74} tz="UTC" />);

    expect(screen.getByText("Moon data unavailable")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The astronomy service did not respond. Try refreshing in a moment.",
      ),
    ).toBeInTheDocument();
  });
});
