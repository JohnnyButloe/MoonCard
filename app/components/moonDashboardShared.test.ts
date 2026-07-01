import { describe, expect, it } from "vitest";

import { getLunarVisibilityState } from "./moonDashboardShared";

describe("getLunarVisibilityState", () => {
  it("does not mark the moon visible when the sun is high", () => {
    const result = getLunarVisibilityState({
      moon: {
        is_up: true,
        altitude_deg: 34,
        illumination_percent: 52,
      },
      sun: {
        is_up: true,
        altitude_deg: 38,
      },
      twilight: {
        current_phase: "day",
      },
      isDarkEnoughForViewing: false,
    });

    expect(result.label).toBe("Not visible right now");
    expect(result.detail).toBe("Above horizon, but daylight limits visibility.");
  });

  it("uses a qualified near-sunset message when the sun is low", () => {
    const result = getLunarVisibilityState({
      moon: {
        is_up: true,
        altitude_deg: 22,
        illumination_percent: 24,
      },
      sun: {
        is_up: true,
        altitude_deg: 4,
      },
      twilight: {
        current_phase: "day",
      },
      isDarkEnoughForViewing: false,
    });

    expect(result.label).toBe("Likely visible near sunset");
    expect(result.detail).toBe("Low sun improves contrast if skies are clear.");
  });

  it("allows visible now after sunset when altitude and illumination are reasonable", () => {
    const result = getLunarVisibilityState({
      moon: {
        is_up: true,
        altitude_deg: 18,
        illumination_percent: 14,
      },
      sun: {
        is_up: false,
        altitude_deg: -9,
      },
      twilight: {
        current_phase: "nautical",
      },
      isDarkEnoughForViewing: true,
    });

    expect(result.label).toBe("Visible now");
    expect(result.detail).toBe("Dark enough to spot if skies are clear.");
  });

  it("never marks the moon visible when it is below the horizon", () => {
    const result = getLunarVisibilityState({
      moon: {
        is_up: false,
        altitude_deg: -4,
        illumination_percent: 68,
      },
      sun: {
        is_up: false,
        altitude_deg: -12,
      },
      twilight: {
        current_phase: "dark",
      },
      isDarkEnoughForViewing: true,
    });

    expect(result.label).toBe("Not visible right now");
    expect(result.detail).toBe("Moon is below the horizon.");
  });
});
