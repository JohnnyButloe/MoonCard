// Placeholder place search for MoonCard.
// Replace with a real API integration later.
"use client";
export type PlaceResult = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  // Trim and validate query
  const q = query.trim();
  if (!q) return [];

  if (q.toLowerCase() === "new york") {
    return [
      {
        id: "new-york-ny",
        label: "New York, USA",
        latitude: 40.7128,
        longitude: -74.006,
        timezone: "America/New_York",
      },
    ];
  }
  // Here you could call a real geocoding API (e.g. Mapbox or OpenCage)
  console.warn("searchPlaces is not implemented; returning default");
  return [];
}
