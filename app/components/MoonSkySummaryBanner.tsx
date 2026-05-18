"use client";

import { useMoonCard } from "../hooks/useAstronomy";
import { useWeatherNow } from "../hooks/useWeather";
import type { WeatherCondition } from "../providers/weather";
import {
  DashboardPanelState,
  DashboardSkeletonBlock,
  DashboardStatusBanner,
} from "./DashboardState";
import {
  DASHBOARD_METRIC_LABEL_CLASS,
  DASHBOARD_PANEL_CLASS,
  DASHBOARD_SURFACE_CLASS,
} from "./moonDashboardShared";

function formatClockTime(iso: string | null | undefined, tz: string): string {
  if (!iso) return "—";

  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  }).format(d);
}

function weatherOutlookLabel(
  condition: WeatherCondition | undefined,
  cloudCoverPct: number | undefined,
) {
  if (typeof cloudCoverPct === "number") {
    if (cloudCoverPct <= 20) return "Mostly clear skies";
    if (cloudCoverPct <= 45) return "Partly cloudy skies";
    if (cloudCoverPct >= 80) return "Overcast skies";
  }

  switch (condition) {
    case "clear":
      return "Clear skies";
    case "partly_cloudy":
      return "Partly cloudy skies";
    case "overcast":
      return "Overcast skies";
    case "rain":
      return "Rainy skies";
    case "snow":
      return "Snowy skies";
    case "storm":
      return "Stormy skies";
    case "fog":
      return "Foggy skies";
    default:
      return "Sky conditions";
  }
}

function buildVisibilitySuggestion({
  sunIsUp,
  nauticalDawn,
  nauticalDusk,
  tz,
}: {
  sunIsUp: boolean | null | undefined;
  nauticalDawn: string | null | undefined;
  nauticalDusk: string | null | undefined;
  tz: string;
}) {
  const relevantTwilight = sunIsUp === true ? nauticalDusk : nauticalDawn;
  const twilightLabel = formatClockTime(relevantTwilight, tz);

  if (twilightLabel !== "—") {
    return `Moon should be visible around nautical twilight at ${twilightLabel}.`;
  }

  return "Moon should be visible around nautical twilight.";
}

function buildSkySummary({
  moonrise,
  moonset,
  highMoon,
  nauticalDawn,
  nauticalDusk,
  tz,
  weatherCondition,
  weatherCloudCover,
  visibilitySummary,
  isDarkEnoughForViewing,
  sunIsUp,
}: {
  moonrise: string | null;
  moonset: string | null;
  highMoon: string | null;
  nauticalDawn: string | null | undefined;
  nauticalDusk: string | null | undefined;
  tz: string;
  weatherCondition: WeatherCondition | undefined;
  weatherCloudCover: number | undefined;
  visibilitySummary: string | null | undefined;
  isDarkEnoughForViewing: boolean | null | undefined;
  sunIsUp: boolean | null | undefined;
}) {
  const riseLabel = formatClockTime(moonrise, tz);
  const setLabel = formatClockTime(moonset, tz);
  const highMoonLabel = formatClockTime(highMoon, tz);
  const timeWindowLabel = sunIsUp === true ? "today" : "tonight";
  const weatherSentence = `${weatherOutlookLabel(weatherCondition, weatherCloudCover)} ${timeWindowLabel}`;

  const firstSentence =
    riseLabel !== "—" && setLabel !== "—"
      ? `Moon rises at ${riseLabel} and sets at ${setLabel}.`
      : riseLabel !== "—"
        ? `Moon rises at ${riseLabel} today.`
        : setLabel !== "—"
          ? `Moon sets at ${setLabel} today.`
          : "Moon rise and set times are temporarily unavailable.";

  if (isDarkEnoughForViewing === true) {
    return `${firstSentence} ${weatherSentence} with good viewing as it reaches peak altitude around ${highMoonLabel}.`;
  }

  if (isDarkEnoughForViewing === false) {
    return `${firstSentence} ${weatherSentence}, but ${visibilitySummary ?? "the sky is not dark enough for easy viewing."} ${buildVisibilitySuggestion({
      sunIsUp,
      nauticalDawn,
      nauticalDusk,
      tz,
    })}`;
  }

  return `${firstSentence} ${weatherSentence}. ${visibilitySummary ?? "Viewing guidance is updating."}`;
}

export default function MoonSkySummaryBanner({
  lat,
  lon,
  tz,
  label = null,
}: {
  lat: number;
  lon: number;
  tz: string;
  label?: string | null;
}) {
  const summaryQ = useMoonCard(lat, lon, tz, { label });
  const weatherQ = useWeatherNow(lat, lon);

  if (summaryQ.error && !summaryQ.data) {
    return (
      <DashboardPanelState
        title="Sky conditions unavailable"
        body="The sky summary could not be loaded right now."
        tone="danger"
        minHeightClass="min-h-[5.5rem]"
      />
    );
  }

  if (!summaryQ.data) {
    return (
      <div className={`${DASHBOARD_PANEL_CLASS} min-h-[5.5rem]`}>
        <div className={`${DASHBOARD_SURFACE_CLASS} px-3.5 py-3`}>
          <DashboardSkeletonBlock className="h-2 w-28 rounded-full" />
          <DashboardSkeletonBlock className="mt-3 h-10 rounded-xl" />
        </div>
      </div>
    );
  }

  const summary = summaryQ.data;
  const skySummary = buildSkySummary({
    moonrise: summary.moon.moonrise,
    moonset: summary.moon.moonset,
    highMoon: summary.moon.high_moon,
    nauticalDawn: summary.twilight.nautical_dawn,
    nauticalDusk: summary.twilight.nautical_dusk,
    tz,
    weatherCondition: weatherQ.data?.condition,
    weatherCloudCover: weatherQ.data?.cloudCoverPct,
    visibilitySummary: summary.visibility.summary,
    isDarkEnoughForViewing: summary.visibility.is_dark_enough_for_viewing,
    sunIsUp: summary.sun.is_up,
  });
  const status =
    summaryQ.error || weatherQ.error
      ? {
          tone: "neutral" as const,
          message: "Sky summary is showing the latest available data.",
        }
      : null;

  return (
    <div className={`${DASHBOARD_PANEL_CLASS} min-h-[5.5rem]`}>
      {status ? (
        <DashboardStatusBanner tone={status.tone}>
          {status.message}
        </DashboardStatusBanner>
      ) : null}

      <section className={`${DASHBOARD_SURFACE_CLASS} px-3.5 py-3`}>
        <div className={DASHBOARD_METRIC_LABEL_CLASS}>Today&apos;s sky conditions</div>
        <p className="mt-2 text-[14px] font-medium leading-6 text-slate-50/94 sm:text-[15px]">
          {skySummary}
        </p>
      </section>
    </div>
  );
}
