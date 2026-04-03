import { keepPreviousData } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { fetchMoonCard } from "../providers/mooncard";

export interface TwilightSegment {
  phase: string | null;
  startLocal: string | null;
  endLocal: string | null;
}

export interface TwilightData {
  currentPhase: string | null;
  nextTransitionLocal?: string | null;
  segments: TwilightSegment[];
  sunEvents?: {
    sunriseLocal?: string | null;
    sunsetLocal?: string | null;
  };
}

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
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    typeof tz === "string" &&
    tz.length > 0;

  return {
    queryKey: [
      "twilight",
      lat,
      lon,
      tz,
      formatInTimeZone(new Date(), tz, "yyyy-MM-dd"),
    ],
    enabled,
    queryFn: async (): Promise<TwilightData> => {
      const summary = await fetchMoonCard({
        lat,
        lon,
        tz,
        requestOrigin: "dashboard",
        baseUrl,
      });
      return {
        currentPhase: summary.twilight.current_phase,
        nextTransitionLocal: summary.twilight.next_transition,
        segments: summary.twilight.segments.map((segment) => ({
          phase: segment.phase,
          startLocal: segment.start,
          endLocal: segment.end,
        })),
        sunEvents: {
          sunriseLocal: summary.sun.sunrise,
          sunsetLocal: summary.sun.sunset,
        },
      };
    },
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  };
}
