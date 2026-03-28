import { keepPreviousData } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { fetchSunEvents, SunEvents } from "../providers/pySun";

export function sunEventsQueryOptions({
  lat,
  lon,
  tz,
  baseUrl,
}: {
  lat: number;
  lon: number;
  tz: string;
  baseUrl?: string;
}) {
  const enabled =
    Number.isFinite(lat) && Number.isFinite(lon) && typeof tz === "string" && tz.length > 0;

  return {
    queryKey: ["sun", lat, lon, tz],
    enabled,
    queryFn: async () => {
      const now = new Date();
      const dateIso = formatInTimeZone(now, tz, "yyyy-MM-dd");
      return fetchSunEvents(lat, lon, dateIso, baseUrl);
    },
    refetchInterval: 30 * 60 * 1000,
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  };
}

export type { SunEvents };
