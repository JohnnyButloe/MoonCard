import DashboardClient from "./components/DashboardClient";
import { DEFAULT_PLACE } from "./lib/places";
import type { CachedLocation } from "./providers/LocationProvider";

export default async function Page() {
  const fallback: CachedLocation = {
    id: "fallback",
    label: DEFAULT_PLACE.label ?? "Default location",
    latitude: DEFAULT_PLACE.latitude,
    longitude: DEFAULT_PLACE.longitude,
    tz: DEFAULT_PLACE.timezone ?? "UTC",
    source: "fallback",
  };

  return <DashboardClient fallback={fallback} initialView="landing" />;
}
