// Simple browser geolocation helper for MoonCard
"use client";
export type BrowserLocation = {
  latitude: number;
  longitude: number;
};

export async function getBrowserLocation(): Promise<BrowserLocation | null> {
  // Guard for server-side / non-browser environments
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    console.warn("Geolocation not available in this environment.");
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => {
        console.error("Error getting browser location:", err);
        resolve(null);
      }
    );
  });
}
