// Client geolocation helper
export type LatLon = { lat: number; lon: number };

export async function getBrowserLocation(timeoutMs = 8000): Promise<LatLon> {
  if (!("geolocation" in navigator)) throw new Error("no-geolocation");
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}
