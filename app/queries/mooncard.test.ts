import { afterEach, describe, expect, it, vi } from "vitest";

import { moonCardQueryOptions } from "./mooncard";

describe("moonCardQueryOptions", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the cache key stable when only the location label changes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T12:00:00Z"));

    const currentLocationKey = moonCardQueryOptions({
      lat: 40.7128,
      lon: -74.006,
      tz: "America/New_York",
      label: "Current location",
    }).queryKey;
    const reverseGeocodedKey = moonCardQueryOptions({
      lat: 40.7128,
      lon: -74.006,
      tz: "America/New_York",
      label: "Brooklyn, New York, United States",
    }).queryKey;

    expect(currentLocationKey).toEqual(reverseGeocodedKey);
  });
});
