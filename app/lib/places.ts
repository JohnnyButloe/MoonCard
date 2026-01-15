// app/lib/places.ts
"use client";

export type PlaceResult = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

export const DEFAULT_PLACE: PlaceResult = {
  id: "new-york-ny",
  label: "New York, USA",
  latitude: 40.7128,
  longitude: -74.006,
  timezone: "America/New_York",
};

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const q = query.trim();
  if (!q) return [];

  if (q.toLowerCase() === "new york") return [DEFAULT_PLACE];

  console.warn("searchPlaces is not implemented; returning default []");
  return [];
}
