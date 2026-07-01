// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildMoonPhaseWindow,
  buildQueryResult,
} from "../test/fixtures/mooncard";

const mockUseMoonPhaseWindow = vi.hoisted(() => vi.fn());

vi.mock("../hooks/useAstronomy", () => ({
  useMoonPhaseWindow: mockUseMoonPhaseWindow,
}));

import MoonCalendarPreview from "./MoonCalendarPreview";

describe("MoonCalendarPreview", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-05T12:00:00Z"));
    mockUseMoonPhaseWindow.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a stable loading state", () => {
    mockUseMoonPhaseWindow.mockReturnValue(buildQueryResult({ isLoading: true }));

    render(<MoonCalendarPreview tz="UTC" />);

    expect(
      screen.getByText("Loading the phase window. This can take a moment."),
    ).toBeInTheDocument();
  });

  it("renders the next lunar events preview", () => {
    mockUseMoonPhaseWindow.mockReturnValue(
      buildQueryResult({
        data: buildMoonPhaseWindow(),
      }),
    );

    render(<MoonCalendarPreview tz="UTC" />);

    expect(mockUseMoonPhaseWindow).toHaveBeenCalledWith("UTC", "2026-04-05", 35);
    expect(screen.getByText("Next lunar events")).toBeInTheDocument();
    expect(screen.getByText("Next 35 days")).toBeInTheDocument();
    expect(screen.getByText("First Quarter")).toBeInTheDocument();
    expect(screen.getByText("Full Moon")).toBeInTheDocument();
  });

  it("shows a degraded banner when cached phase data is being reused after an error", () => {
    mockUseMoonPhaseWindow.mockReturnValue(
      buildQueryResult({
        data: buildMoonPhaseWindow(),
        error: new Error("py-astro-phases-failed"),
      }),
    );

    render(<MoonCalendarPreview tz="UTC" />);

    expect(
      screen.getByText("Phase refresh failed. Showing the last preview."),
    ).toBeInTheDocument();
  });

  it("renders an error shell when the preview cannot be loaded", () => {
    mockUseMoonPhaseWindow.mockReturnValue(
      buildQueryResult({
        error: new Error("py-astro-phases-failed"),
      }),
    );

    render(<MoonCalendarPreview tz="UTC" />);

    expect(screen.getByText("Calendar preview unavailable")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The upcoming phase preview could not be loaded right now.",
      ),
    ).toBeInTheDocument();
  });
});
