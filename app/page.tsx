// app/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import MoonNowCard from "./components/MoonCardNow";
import LocationTag from "./components/LocationTag";

import { DEFAULT_PLACE } from "./lib/places";
import { getBrowserLocation, formatGeoError } from "./lib/location";

type LocationSource = "geolocation" | "cache" | "fallback";

type CachedLocation = {
  label: string;
  latitude: number;
  longitude: number;
  tz?: string;
  source: LocationSource;
};

const STORAGE_KEY = "mooncard:lastLocation";

function readCachedLocation(): CachedLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedLocation;

    // minimal shape validation
    if (
      typeof parsed?.latitude === "number" &&
      typeof parsed?.longitude === "number" &&
      typeof parsed?.label === "string" &&
      typeof parsed?.source === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeCachedLocation(loc: CachedLocation) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  } catch {
    // ignore write failures (privacy mode, storage disabled, etc.)
  }
}

export default function Page() {
  // Guard against StrictMode double-running effects in dev
  const didInit = useRef(false);

  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Set an immediate location (cache -> fallback) so UI never blocks on geolocation
  const [loc, setLoc] = useState<CachedLocation>(() => {
    // SSR-safe: if window isn't available, use fallback
    if (typeof window === "undefined") {
      return {
        label: DEFAULT_PLACE.label ?? "Default location",
        latitude: DEFAULT_PLACE.latitude,
        longitude: DEFAULT_PLACE.longitude,
        tz: DEFAULT_PLACE.timezone ?? browserTz,
        source: "fallback",
      };
    }

    const cached = readCachedLocation();
    if (cached) {
      return {
        ...cached,
        source: "cache",
        // if cached tz is missing, keep browser tz
        tz: cached.tz ?? browserTz,
      };
    }

    return {
      label: DEFAULT_PLACE.label ?? "Default location",
      latitude: DEFAULT_PLACE.latitude,
      longitude: DEFAULT_PLACE.longitude,
      tz: DEFAULT_PLACE.timezone ?? browserTz,
      source: "fallback",
    };
  });

  // Keep tz as its own state so existing MoonNowCard logic stays the same
  const [tz, setTz] = useState<string>(() => loc.tz ?? browserTz);

  useEffect(() => {
    // Ensure tz stays in sync if loc changes (e.g. cache->geolocation)
    if (loc.tz && loc.tz !== tz) setTz(loc.tz);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.tz]);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    (async () => {
      const res = await getBrowserLocation({
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 60_000,
      });

      if (res.ok) {
        const next: CachedLocation = {
          label: "Current location",
          latitude: res.location.latitude,
          longitude: res.location.longitude,
          tz: browserTz,
          source: "geolocation",
        };

        setLoc(next);
        setTz(browserTz);
        writeCachedLocation(next);
      } else {
        console.warn(formatGeoError(res.error));
        // Do nothing: we already rendered cache/fallback immediately
      }
    })();
  }, [browserTz]);

  return (
    <main className="relative mx-auto max-w-3xl p-6">
      {/* Location tag */}
      <div className="flex justify-end mb-2">
        <LocationTag
          label={loc.label}
          latitude={loc.latitude}
          longitude={loc.longitude}
          source={loc.source}
        />
      </div>

      {/* Preserve existing MoonNowCard behavior */}
      <MoonNowCard lat={loc.latitude} lon={loc.longitude} tz={tz} />
    </main>
  );
}
