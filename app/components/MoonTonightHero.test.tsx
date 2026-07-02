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

import MoonTonightHero, { selectBestViewingTarget } from "./MoonTonightHero";

describe("MoonTonightHero", () => {
  beforeEach(() => {
    mockUseMoonCard.mockReset();
    mockUseWeatherNow.mockReset();
  });

  it("uses high moon instead of nautical dusk when the moon rises after dusk", () => {
    mockUseMoonCard.mockReturnValue(
      buildQueryResult({
        data: buildCanonicalMoonCardResponse({
          meta: {
            timestamp_iso: "2026-04-05T21:20:00Z",
          },
          moon: {
            is_up: false,
            altitude_deg: -4,
            azimuth_deg: 84,
            moonrise: "2026-04-05T22:02:00Z",
            moonset: "2026-04-06T08:10:00Z",
            high_moon: "2026-04-06T01:32:00Z",
            path: {
              window_start_local: "2026-04-05T00:00:00+00:00",
              window_end_local: "2026-04-06T12:00:00+00:00",
              sample_count: 3,
              samples: [
                {
                  time_utc: "2026-04-05T21:36:00Z",
                  time_local: "2026-04-05T21:36:00+00:00",
                  altitude_deg: -2,
                  azimuth_deg: 88,
                  above_horizon: false,
                },
                {
                  time_utc: "2026-04-06T01:32:00Z",
                  time_local: "2026-04-06T01:32:00+00:00",
                  altitude_deg: 54,
                  azimuth_deg: 181,
                  above_horizon: true,
                },
                {
                  time_utc: "2026-04-06T06:00:00Z",
                  time_local: "2026-04-06T06:00:00+00:00",
                  altitude_deg: 18,
                  azimuth_deg: 245,
                  above_horizon: true,
                },
              ],
            },
          },
          sun: {
            is_up: false,
            altitude_deg: -8,
          },
          twilight: {
            current_phase: "civil",
            nautical_dusk: "2026-04-05T21:36:00Z",
            next_transition: "2026-04-05T21:05:00Z",
          },
          visibility: {
            is_dark_enough_for_viewing: false,
            summary: "Nautical twilight has not started yet.",
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
    expect(screen.getByText("Peak at 1:32 AM")).toBeInTheDocument();
    expect(screen.getByText("Look south · Peak altitude.")).toBeInTheDocument();
    expect(screen.queryByText("After 9:36 PM")).not.toBeInTheDocument();
    expect(screen.getByText("Not visible right now")).toBeInTheDocument();
  });

  it("selects the highest above-horizon path sample when high moon is missing", () => {
    const target = selectBestViewingTarget({
      currentIso: "2026-04-05T20:00:00Z",
      nauticalDusk: "2026-04-05T19:30:00Z",
      isDarkEnoughForViewing: true,
      nextTransition: null,
      currentIsUp: true,
      moonrise: "2026-04-05T19:00:00Z",
      highMoon: null,
      moonset: "2026-04-05T23:00:00Z",
      pathSamples: [
        {
          time_utc: "2026-04-05T20:30:00Z",
          time_local: "2026-04-05T20:30:00+00:00",
          altitude_deg: 20,
          azimuth_deg: 120,
          above_horizon: true,
        },
        {
          time_utc: "2026-04-05T21:30:00Z",
          time_local: "2026-04-05T21:30:00+00:00",
          altitude_deg: 45,
          azimuth_deg: 180,
          above_horizon: true,
        },
        {
          time_utc: "2026-04-05T22:00:00Z",
          time_local: "2026-04-05T22:00:00+00:00",
          altitude_deg: 52,
          azimuth_deg: 210,
          above_horizon: false,
        },
      ],
    });

    expect(target).toMatchObject({
      status: "target",
      source: "path_sample",
      iso: "2026-04-05T21:30:00Z",
      altitudeDeg: 45,
    });
  });

  it("ignores a stale moonset from before moonrise when high moon is overnight", () => {
    const target = selectBestViewingTarget({
      currentIso: "2026-04-05T21:20:00Z",
      nauticalDusk: "2026-04-05T21:36:00Z",
      isDarkEnoughForViewing: false,
      nextTransition: "2026-04-05T21:05:00Z",
      currentIsUp: false,
      moonrise: "2026-04-05T22:02:00Z",
      highMoon: "2026-04-06T01:32:00Z",
      moonset: "2026-04-05T08:10:00Z",
      pathSamples: null,
    });

    expect(target).toMatchObject({
      status: "target",
      source: "high_moon",
      iso: "2026-04-06T01:32:00Z",
    });
  });

  it("falls back to now when high moon has passed and the moon is still visible", () => {
    const target = selectBestViewingTarget({
      currentIso: "2026-04-05T22:00:00Z",
      nauticalDusk: "2026-04-05T19:30:00Z",
      isDarkEnoughForViewing: true,
      nextTransition: null,
      currentIsUp: true,
      moonrise: "2026-04-05T18:00:00Z",
      highMoon: "2026-04-05T20:00:00Z",
      moonset: "2026-04-05T23:00:00Z",
      pathSamples: null,
    });

    expect(target).toMatchObject({
      status: "now",
      source: "past_peak",
      iso: "2026-04-05T22:00:00Z",
    });
  });

  it("returns unavailable when the moon is below horizon and timing data is missing", () => {
    const target = selectBestViewingTarget({
      currentIso: "2026-04-05T21:00:00Z",
      nauticalDusk: "2026-04-05T20:00:00Z",
      isDarkEnoughForViewing: true,
      nextTransition: null,
      currentIsUp: false,
      moonrise: null,
      highMoon: null,
      moonset: null,
      pathSamples: null,
    });

    expect(target).toEqual({
      status: "unavailable",
      reason: "missing_moon_timing",
    });
  });
});
