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

vi.mock("./MoonCardNow", () => ({
  default: () => <div>moon-now-panel</div>,
}));

vi.mock("./MoonGraph", () => ({
  default: () => <div>moon-graph-panel</div>,
}));

vi.mock("./MoonPhaseCalendar", () => ({
  default: () => <div>moon-phase-calendar</div>,
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
      selectLocation: vi.fn(),
    });

    render(<DashboardClient fallback={fallbackLocation} />);

    expect(screen.getByText("Mooncard")).toBeInTheDocument();
    expect(screen.getByText("moon-now-panel")).toBeInTheDocument();
    expect(screen.getByText("moon-phase-calendar")).toBeInTheDocument();
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
});
