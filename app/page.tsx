// app/page.tsx
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { headers } from "next/headers";
import DashboardClient from "./components/DashboardClient";
import { DEFAULT_PLACE } from "./lib/places";
import { lunarNowQueryOptions, moonTodayQueryOptions } from "./queries/lunar";
import { twilightQueryOptions } from "./queries/twilight";
import { sunEventsQueryOptions } from "./queries/sun";
import type { CachedLocation } from "./providers/LocationProvider";

async function getRequestBaseUrl() {
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  if (!host) return "http://localhost:3000";
  return `${proto}://${host}`;
}

export default async function Page() {
  const fallback: CachedLocation = {
    id: "fallback",
    label: DEFAULT_PLACE.label ?? "Default location",
    latitude: DEFAULT_PLACE.latitude,
    longitude: DEFAULT_PLACE.longitude,
    tz: DEFAULT_PLACE.timezone ?? "UTC",
    source: "fallback",
  };

  const baseUrl = await getRequestBaseUrl();
  const queryClient = new QueryClient();

  await Promise.all([
    queryClient.prefetchQuery(
      lunarNowQueryOptions({
        lat: fallback.latitude,
        lon: fallback.longitude,
        tz: fallback.tz ?? "UTC",
        baseUrl,
      }),
    ),
    queryClient.prefetchQuery(
      moonTodayQueryOptions({
        lat: fallback.latitude,
        lon: fallback.longitude,
        tz: fallback.tz ?? "UTC",
        baseUrl,
      }),
    ),
    queryClient.prefetchQuery(
      twilightQueryOptions({
        lat: fallback.latitude,
        lon: fallback.longitude,
        tz: fallback.tz ?? "UTC",
        baseUrl,
      }),
    ),
    queryClient.prefetchQuery(
      sunEventsQueryOptions({
        lat: fallback.latitude,
        lon: fallback.longitude,
        tz: fallback.tz ?? "UTC",
        baseUrl,
      }),
    ),
  ]);

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <DashboardClient fallback={fallback} />
    </HydrationBoundary>
  );
}
