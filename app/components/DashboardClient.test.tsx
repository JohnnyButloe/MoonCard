// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseLocation = vi.hoisted(() => vi.fn());
const mockPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("../providers/LocationProvider", () => ({
  LocationProvider: ({ children }: { children: React.ReactNode }) => children,
  useLocation: mockUseLocation,
}));

vi.mock("./MoonContextCard", () => ({
  default: () => <div>moon-context-panel</div>,
}));

vi.mock("./MoonGraph", () => ({
  default: () => <div>moon-graph-panel</div>,
}));

vi.mock("./MoonSupportingDetails", () => ({
  default: () => <div>moon-supporting-details-panel</div>,
}));

vi.mock("./MoonPhaseCalendar", () => ({
  default: () => <div>moon-phase-calendar-panel</div>,
}));

vi.mock("./MoonCalendarPreview", () => ({
  default: () => <div>moon-calendar-preview-panel</div>,
}));

vi.mock("./LocationTag", () => ({
  default: () => <button type="button">location-tag</button>,
}));

vi.mock("./LocationSearch", () => ({
  default: () => <div>location-search</div>,
}));

vi.mock("./LocationOnboarding", () => ({
  default: () => <div>location-onboarding</div>,
}));

vi.mock("./MoonTonightHero", () => ({
  default: () => <div>moon-tonight-hero-panel</div>,
}));

import DashboardClient from "./DashboardClient";

const fallbackLocation = {
  id: "fallback",
  label: "Fallback",
  latitude: 40.7128,
  longitude: -74.006,
  tz: "UTC",
  source: "fallback" as const,
};

describe("DashboardClient", () => {
  beforeEach(() => {
    mockUseLocation.mockReset();
    mockPush.mockReset();
  });

  it("renders the full dashboard surfaces when an active location is available", () => {
    mockUseLocation.mockReturnValue({
      active: fallbackLocation,
      tz: "UTC",
      current: null,
      isLocating: false,
      hasCompletedOnboarding: true,
      selectCurrentLocation: vi.fn(),
      selectLocation: vi.fn(),
    });

    render(<DashboardClient fallback={fallbackLocation} />);

    expect(screen.getByText("MoonCard")).toBeInTheDocument();
    expect(screen.getByLabelText("Moon overview")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Viewing conditions and weather"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Today's sky timeline")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Supporting lunar details"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Lunar calendar")).toBeInTheDocument();
    expect(screen.getByLabelText("Next lunar events")).toBeInTheDocument();
    expect(screen.getByText("moon-tonight-hero-panel")).toBeInTheDocument();
    expect(screen.getByText("moon-context-panel")).toBeInTheDocument();
    expect(
      screen.getByText("moon-supporting-details-panel"),
    ).toBeInTheDocument();
    expect(screen.getByText("moon-phase-calendar-panel")).toBeInTheDocument();
    expect(screen.getByText("moon-calendar-preview-panel")).toBeInTheDocument();
    expect(screen.getByText("moon-graph-panel")).toBeInTheDocument();
    expect(screen.getByText("location-tag")).toBeInTheDocument();
  });

  it("renders an intentional empty state when no location is selected", () => {
    mockUseLocation.mockReturnValue({
      active: {
        ...fallbackLocation,
        latitude: Number.NaN,
        longitude: Number.NaN,
      },
      tz: "",
      current: null,
      isLocating: false,
      hasCompletedOnboarding: true,
      selectCurrentLocation: vi.fn(),
      selectLocation: vi.fn(),
    });

    render(<DashboardClient fallback={fallbackLocation} />);

    expect(screen.getByText("Choose a location")).toBeInTheDocument();
    expect(
      screen.getByText("Select a place to load the lunar dashboard."),
    ).toBeInTheDocument();
    expect(screen.queryByText("moon-now-panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Set location" })[0]);

    expect(screen.getByText("Change the dashboard location")).toBeInTheDocument();
    expect(screen.getByText("location-search")).toBeInTheDocument();
  });

  it("uses the live current location path instead of saving a static copy", () => {
    const selectCurrentLocation = vi.fn();
    const selectLocation = vi.fn();

    mockUseLocation.mockReturnValue({
      active: {
        ...fallbackLocation,
        latitude: Number.NaN,
        longitude: Number.NaN,
      },
      tz: "",
      current: {
        id: "current",
        label: "Brooklyn, New York, United States",
        latitude: 40.7128,
        longitude: -74.006,
        tz: "America/New_York",
        source: "current",
      },
      isLocating: false,
      hasCompletedOnboarding: true,
      selectCurrentLocation,
      selectLocation,
    });

    render(<DashboardClient fallback={fallbackLocation} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Set location" })[0]);
    fireEvent.click(
      screen.getByRole("button", {
        name: /Brooklyn, New York, United States/i,
      }),
    );

    expect(selectCurrentLocation).toHaveBeenCalledTimes(1);
    expect(selectLocation).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });
});
