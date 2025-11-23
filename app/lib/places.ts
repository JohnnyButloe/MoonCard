// Placeholder place search for MoonCard.
// Replace with a real API integration later.
"use client";
export type PlaceResult = {
  id: string;
  label: string;
};

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  if (!query.trim()) {
    return [];
  }

  // TODO: Replace with real implementation (Mapbox, OpenCage, etc.)
  console.warn("searchPlaces is not implemented yet. Returning [] for now.");
  return [];
}
