import { formatInTimeZone } from "date-fns-tz";

import {
  fetchMoonCard,
  type FetchMoonCardArgs,
} from "../providers/mooncard";
import type { MoonCardRequestOrigin, MoonCardResponse } from "../lib/mooncard/types";

export interface MoonCardQueryArgs {
  lat: number;
  lon: number;
  tz: string;
  label?: string | null;
  requestOrigin?: MoonCardRequestOrigin | null;
  baseUrl?: string;
}

function toFetchArgs(args: MoonCardQueryArgs): FetchMoonCardArgs {
  return {
    lat: args.lat,
    lon: args.lon,
    tz: args.tz,
    label: args.label ?? null,
    requestOrigin: args.requestOrigin ?? "dashboard",
    baseUrl: args.baseUrl,
  };
}

export function moonCardQueryOptions(args: MoonCardQueryArgs) {
  const enabled =
    Number.isFinite(args.lat) &&
    Number.isFinite(args.lon) &&
    typeof args.tz === "string" &&
    args.tz.length > 0;

  return {
    queryKey: [
      "mooncard",
      args.lat,
      args.lon,
      args.tz,
      args.requestOrigin ?? "dashboard",
      // Key by local calendar day so client caching lines up with the same
      // location-day unit we can reuse later for normalized server-side caches.
      // The human label is intentionally excluded so late reverse-geocode or
      // rename updates do not cause location-stable dashboard panels to flash.
      formatInTimeZone(new Date(), args.tz, "yyyy-MM-dd"),
    ],
    enabled,
    queryFn: async (): Promise<MoonCardResponse> => fetchMoonCard(toFetchArgs(args)),
    refetchInterval: 60_000,
    staleTime: 30_000,
  };
}

export type { MoonCardResponse };
