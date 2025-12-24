// app/lib/location.ts
"use client";

export type BrowserLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
};

export type GeoResult =
  | { ok: true; location: BrowserLocation }
  | { ok: false; error: unknown };

const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 6000,
  maximumAge: 60_000,
};

export function getBrowserLocation(
  options: PositionOptions = DEFAULT_OPTIONS
): Promise<GeoResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ ok: false, error: new Error("no-geolocation") });
  }

  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: GeoResult) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    // extra safety in case a browser ignores PositionOptions.timeout
    const hardTimeoutMs = (options.timeout ?? 6000) + 1000;
    const hardTimer = window.setTimeout(() => {
      settle({ ok: false, error: new Error("geolocation-hard-timeout") });
    }, hardTimeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(hardTimer);
        settle({
          ok: true,
          location: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
          },
        });
      },
      (err) => {
        window.clearTimeout(hardTimer);
        settle({ ok: false, error: err });
      },
      options
    );
  });
}

export function formatGeoError(err: unknown) {
  // Useful for logging / debugging
  if (err && typeof err === "object" && "code" in err && "message" in err) {
    const e = err as GeolocationPositionError;
    return `Geolocation error (${e.code}): ${e.message}`;
  }
  return String(err);
}
