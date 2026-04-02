import { keepPreviousData } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { fetchAstronomySummary } from "../providers/pyAstronomy";

export interface TwilightSegment {
  phase: string;
  startLocal: string;
  endLocal: string;
}

export interface TwilightData {
  timezoneOffset?: string;
  currentPhase: string;
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
      const summary = await fetchAstronomySummary(
        lat,
        lon,
        tz,
        new Date().toISOString(),
        baseUrl,
      );
      return {
        timezoneOffset: summary.twilight.timezone_offset,
        currentPhase: summary.twilight.current_phase,
        nextTransitionLocal: summary.twilight.next_transition_local,
        segments: summary.twilight.segments.map((segment) => ({
          phase: segment.phase,
          startLocal: segment.start_local,
          endLocal: segment.end_local,
        })),
        sunEvents: {
          sunriseLocal: summary.twilight.sun_events.sunrise_local,
          sunsetLocal: summary.twilight.sun_events.sunset_local,
        },
      };
    },
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  };
}
