// app/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import MoonNowCard from "./components/MoonCardNow";
import LocationTag from "./components/LocationTag";

import { DEFAULT_PLACE } from "./lib/places";
import { getBrowserLocation, formatGeoError } from "./lib/location";
import { reverseGeocode } from "./lib/reverseGeocode";

import MoonAltitudeGraph from "./components/MoonGraph";
import TwilightPhaseBar from "./components/TwilightPhaseBar";

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
  const didInit = useRef(false);

  // Stable fallback rendered on BOTH server and first client render
  const FALLBACK_LOC: CachedLocation = {
    label: DEFAULT_PLACE.label ?? "Default location",
    latitude: DEFAULT_PLACE.latitude,
    longitude: DEFAULT_PLACE.longitude,
    tz: DEFAULT_PLACE.timezone ?? "UTC",
    source: "fallback",
  };

  // IMPORTANT: do NOT read localStorage/geolocation during initial render
  const [loc, setLoc] = useState<CachedLocation>(FALLBACK_LOC);
  const [tz, setTz] = useState<string>(FALLBACK_LOC.tz ?? "UTC");

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    (async () => {
      // 1) Resolve browser timezone AFTER mount (client only)
      const tzClient =
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        (FALLBACK_LOC.tz ?? "UTC");

      // 2) Load cached location AFTER mount (client only)
      const cached = readCachedLocation();
      if (cached) {
        const cachedLoc: CachedLocation = {
          ...cached,
          source: "cache",
          tz: cached.tz ?? tzClient,
        };
        setLoc(cachedLoc);
        setTz(cachedLoc.tz ?? tzClient);
      } else {
        setTz(FALLBACK_LOC.tz ?? tzClient);
      }

      // 3) Try geolocation (non-blocking UI)
      const res = await getBrowserLocation({
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 60_000,
      });

      if (!res.ok) {
        console.warn(formatGeoError(res.error));
        return; // keep cache/fallback
      }

      const { latitude, longitude } = res.location;

      const next: CachedLocation = {
        label: "Current location",
        latitude,
        longitude,
        tz: tzClient,
        source: "geolocation",
      };

      setLoc(next);
      setTz(tzClient);
      writeCachedLocation(next);

      // 4) Reverse geocode label
      const rg = await reverseGeocode(latitude, longitude, {
        localityLanguage: "en",
        timeoutMs: 4000,
      });

      if (rg?.label) {
        setLoc((prev) => {
          if (prev.latitude !== latitude || prev.longitude !== longitude)
            return prev;

          const updated: CachedLocation = { ...prev, label: rg.label };
          writeCachedLocation(updated);
          return updated;
        });
      }
    })();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative mx-auto max-w-6xl px-6 py-8">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 right-6 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-8 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>

        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-200/60">
              Lunar dashboard
            </p>
            <h1 className="text-2xl font-semibold">Mooncard</h1>
          </div>
          <LocationTag
            label={loc.label}
            latitude={loc.latitude}
            longitude={loc.longitude}
            source={loc.source}
          />
        </header>

        <div className="grid gap-6 lg:grid-cols-12">
          <section className="lg:col-span-7 xl:col-span-8">
            <MoonNowCard lat={loc.latitude} lon={loc.longitude} tz={tz} />
          </section>
          <section className="flex flex-col gap-6 lg:col-span-5 xl:col-span-4">
            <TwilightPhaseBar lat={loc.latitude} lon={loc.longitude} tz={tz} />
            <MoonAltitudeGraph lat={loc.latitude} lon={loc.longitude} tz={tz} />
          </section>
        </div>
      </div>
    </main>
  );
}
