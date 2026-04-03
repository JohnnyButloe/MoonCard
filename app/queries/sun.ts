import { keepPreviousData } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { fetchMoonCard } from "../providers/mooncard";

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
      const summary = await fetchMoonCard({
        lat,
        lon,
        tz,
        requestOrigin: "dashboard",
        baseUrl,
      });
      return {
        sunriseLocal: summary.sun.sunrise,
        sunsetLocal: summary.sun.sunset,
      };
    },
    refetchInterval: 30 * 60 * 1000,
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  };
}
