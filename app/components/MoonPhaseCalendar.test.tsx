// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildMoonPhaseWindow,
  buildQueryResult,
} from "../test/fixtures/mooncard";

const mockUseMoonPhaseWindow = vi.hoisted(() => vi.fn());

vi.mock("../hooks/useAstronomy", () => ({
  useMoonPhaseWindow: mockUseMoonPhaseWindow,
}));

import MoonPhaseCalendar from "./MoonPhaseCalendar";

describe("MoonPhaseCalendar", () => {
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

    render(<MoonPhaseCalendar tz="UTC" />);

    expect(
      screen.getByText("Loading the phase window. This can take a moment."),
    ).toBeInTheDocument();
  });

  it("keeps week navigation wired to the phase-window query and preserves the phase popup", async () => {
    mockUseMoonPhaseWindow.mockImplementation(() =>
      buildQueryResult({
        data: buildMoonPhaseWindow(),
      }),
    );

    render(<MoonPhaseCalendar tz="UTC" />);

    expect(mockUseMoonPhaseWindow).toHaveBeenCalledWith("UTC", "2026-04-05", 35);

    fireEvent.click(screen.getByLabelText("View next week window"));

    expect(mockUseMoonPhaseWindow).toHaveBeenLastCalledWith(
      "UTC",
      "2026-04-12",
      35,
    );

    fireEvent.click(
      screen.getByLabelText("First Quarter on April 6 at 9:12 PM"),
    );

    expect(screen.getByText("First Quarter")).toBeInTheDocument();
    expect(screen.getByText("9:12 PM")).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByText("Click anywhere to close")).not.toBeInTheDocument();
  });

  it("shows a degraded banner when cached phase data is being reused after an error", () => {
    mockUseMoonPhaseWindow.mockReturnValue(
      buildQueryResult({
        data: buildMoonPhaseWindow(),
        error: new Error("py-astro-phases-failed"),
      }),
    );

    render(<MoonPhaseCalendar tz="UTC" />);

    expect(
      screen.getByText("Phase refresh failed. Showing the last window."),
    ).toBeInTheDocument();
    expect(screen.getByText("Major phases")).toBeInTheDocument();
  });

  it("renders an intentional empty state when no phase entries are available", () => {
    const emptyWindow = buildMoonPhaseWindow({
      days: buildMoonPhaseWindow().days.map((day) => ({
        ...day,
        phases: [],
      })),
    });

    mockUseMoonPhaseWindow.mockReturnValue(
      buildQueryResult({
        data: emptyWindow,
      }),
    );

    render(<MoonPhaseCalendar tz="UTC" />);

    expect(screen.getByText("No phases in this window")).toBeInTheDocument();
    expect(
      screen.getByText("Try another week to load upcoming major phases."),
    ).toBeInTheDocument();
  });

  it("renders an error shell when the phase window is unavailable", () => {
    mockUseMoonPhaseWindow.mockReturnValue(
      buildQueryResult({
        error: new Error("py-astro-phases-failed"),
      }),
    );

    render(<MoonPhaseCalendar tz="UTC" />);

    expect(screen.getByText("Phase window unavailable")).toBeInTheDocument();
    expect(
      screen.getByText("The calendar could not load this window."),
    ).toBeInTheDocument();
  });
});
