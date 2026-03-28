import { keepPreviousData } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { fetchTwilight, TwilightData } from "../providers/pyTwilight";

export function twilightQueryOptions({
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
    queryKey: ["twilight", lat, lon, tz],
    enabled,
    queryFn: async () => {
      const now = new Date();
      const dateIso = formatInTimeZone(now, tz, "yyyy-MM-dd");
      const isoUtc = now.toISOString();
      return fetchTwilight(lat, lon, dateIso, isoUtc, baseUrl);
    },
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  };
}

export type { TwilightData };
