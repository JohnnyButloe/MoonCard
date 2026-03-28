import { US_CITIES } from "./usCities";

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

export const FEATURED_PLACES: PlaceResult[] = [
  US_CITIES[0],
  US_CITIES[1],
  US_CITIES[2],
  US_CITIES[12],
  US_CITIES[13],
  US_CITIES[14],
].map((city) => ({
  id: city.id,
  label: city.label,
  latitude: city.latitude,
  longitude: city.longitude,
  timezone: city.tz,
}));
