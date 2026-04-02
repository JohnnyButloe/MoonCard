import { keepPreviousData } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { fetchAstronomySummary } from "../providers/pyAstronomy";

export type SunEvents = {
  sunriseLocal?: string | null;
  sunsetLocal?: string | null;
};

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
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    typeof tz === "string" &&
    tz.length > 0;

  return {
    queryKey: [
      "sun",
      lat,
      lon,
      tz,
      formatInTimeZone(new Date(), tz, "yyyy-MM-dd"),
    ],
    enabled,
    queryFn: async (): Promise<SunEvents> => {
      const summary = await fetchAstronomySummary(
        lat,
        lon,
        tz,
        new Date().toISOString(),
        baseUrl,
      );
      return {
        sunriseLocal: summary.sun.events.sunrise_local,
        sunsetLocal: summary.sun.events.sunset_local,
      };
    },
    refetchInterval: 30 * 60 * 1000,
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  };
}
