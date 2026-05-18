"use client";

import { useMoonCard } from "../hooks/useAstronomy";
import { useWeatherNow } from "../hooks/useWeather";
import type { WeatherCondition } from "../providers/weather";
import {
  DashboardPanelState,
  DashboardSkeletonBlock,
  DashboardStatusBanner,
} from "./DashboardState";
import { MoonPhaseCircle } from "./MoonPhaseCircle";
import {
  DASHBOARD_METRIC_TILE_CLASS,
  DASHBOARD_METRIC_LABEL_CLASS,
  DASHBOARD_MUTED_TEXT_CLASS,
  DASHBOARD_PANEL_CLASS,
  DASHBOARD_PANEL_EYEBROW_CLASS,
  DASHBOARD_SURFACE_CLASS,
  DASHBOARD_VALUE_CLASS,
  DASHBOARD_VALUE_LARGE_CLASS,
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

function formatPercent(value: number | null): string {
  return typeof value === "number" ? `${Math.round(value)}%` : "—";
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

function getVisibilityState(isUp: boolean | null | undefined) {
  if (isUp === true) {
    return {
      badge: "Visible now",
      detail: "Currently visible over the horizon.",
      badgeClass: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100/90",
    };
  }

  if (isUp === false) {
    return {
      badge: "Below horizon",
      detail: "Currently below the horizon.",
      badgeClass: "border-white/10 bg-white/[0.04] text-slate-200/82",
    };
  }

  return {
    badge: "Status pending",
    detail: "Horizon state is temporarily unavailable.",
    badgeClass: "border-white/10 bg-white/[0.04] text-slate-200/82",
  };
}

export default function MoonTonightHero({
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
        title="Tonight's snapshot unavailable"
        body="The astronomy service did not respond. Try refreshing in a moment."
        tone="danger"
        minHeightClass="min-h-[16rem] lg:min-h-[15rem]"
      />
    );
  }

  if (!summaryQ.data) {
    return (
      <div className={`${DASHBOARD_PANEL_CLASS} min-h-[16rem] gap-3.5 lg:min-h-[15rem] lg:gap-3`}>
        <DashboardSkeletonBlock className="h-2 w-32 rounded-full" />

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(16.5rem,0.9fr)] lg:items-start">
          <div className="space-y-3">
            <DashboardSkeletonBlock className="h-[5.5rem] rounded-[1.1rem]" />
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <DashboardSkeletonBlock
                  key={`moon-tonight-timing-skeleton-${index}`}
                  className="h-[4.65rem] rounded-[1rem]"
                />
              ))}
            </div>
          </div>

          <DashboardSkeletonBlock className="h-[10.75rem] rounded-[1.2rem]" />
        </div>

        <DashboardStatusBanner>
          Loading tonight&apos;s snapshot. This can take a moment.
        </DashboardStatusBanner>
      </div>
    );
  }

  const summary = summaryQ.data;
  const moon = summary.moon;
  const missingHeroFieldCount = [
    moon.phase_name,
    moon.illumination_percent,
    moon.is_up,
    moon.moonrise,
    moon.high_moon,
    moon.moonset,
  ].filter((value) => value === null || value === undefined).length;
  const visibilityState = getVisibilityState(moon.is_up);
  const astronomyStatus =
    summaryQ.error
      ? {
          tone: "warning" as const,
          message: "Astronomy refresh failed. Showing the last update.",
        }
      : summary.errors.length > 0
        ? {
            tone: "warning" as const,
            message: "Astronomy data is degraded. Some tonight details may be limited.",
          }
        : missingHeroFieldCount > 0
          ? {
              tone: "neutral" as const,
              message: "Some tonight details are unavailable right now.",
            }
          : null;
  const weatherStatus =
    weatherQ.error
      ? {
          tone: "neutral" as const,
          message: weatherQ.data
            ? "Weather refresh failed. Showing the latest available conditions."
            : "Live weather is unavailable right now. The summary is based on astronomy data.",
        }
      : null;
  const skySummary = buildSkySummary({
    moonrise: moon.moonrise,
    moonset: moon.moonset,
    highMoon: moon.high_moon,
    nauticalDawn: summary.twilight.nautical_dawn,
    nauticalDusk: summary.twilight.nautical_dusk,
    tz,
    weatherCondition: weatherQ.data?.condition,
    weatherCloudCover: weatherQ.data?.cloudCoverPct,
    visibilitySummary: summary.visibility.summary,
    isDarkEnoughForViewing: summary.visibility.is_dark_enough_for_viewing,
    sunIsUp: summary.sun.is_up,
  });
  const timingItems = [
    {
      label: "Moonrise",
      value: formatClockTime(moon.moonrise, tz),
      detail: "Moon clears the horizon.",
    },
    {
      label: "Peak altitude",
      value: formatClockTime(moon.high_moon, tz),
      detail: "Highest point in the sky.",
    },
    {
      label: "Moonset",
      value: formatClockTime(moon.moonset, tz),
      detail: "Moon drops below the horizon.",
    },
  ];

  return (
    <div className={`${DASHBOARD_PANEL_CLASS} min-h-[16rem] gap-3.5 lg:min-h-[15rem] lg:gap-3`}>
      <header className="min-w-0">
        <p className={DASHBOARD_PANEL_EYEBROW_CLASS}>Tonight at a glance</p>
      </header>

      {astronomyStatus || weatherStatus ? (
        <div className="space-y-2">
          {astronomyStatus ? (
            <DashboardStatusBanner tone={astronomyStatus.tone}>
              {astronomyStatus.message}
            </DashboardStatusBanner>
          ) : null}
          {weatherStatus ? (
            <DashboardStatusBanner tone={weatherStatus.tone}>
              {weatherStatus.message}
            </DashboardStatusBanner>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(16.5rem,0.9fr)] lg:items-start">
        <section className="space-y-3 lg:pr-1">
          <p className="max-w-[64ch] text-[14px] font-medium leading-6 text-slate-50/94 sm:text-[15px]">
            {skySummary}
          </p>

          <div className="grid grid-cols-3 gap-2">
            {timingItems.map((item) => (
              <div
                key={item.label}
                className={`${DASHBOARD_METRIC_TILE_CLASS} flex min-h-[4.65rem] flex-col justify-between px-2.5 py-2.5`}
              >
                <div className={DASHBOARD_METRIC_LABEL_CLASS}>{item.label}</div>
                <div className={`${DASHBOARD_VALUE_CLASS} text-[0.96rem] leading-tight`}>
                  {item.value}
                </div>
                <div className={DASHBOARD_MUTED_TEXT_CLASS}>{item.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section
          className={`${DASHBOARD_SURFACE_CLASS} flex flex-col justify-center gap-3 py-3.5 lg:min-h-[10.75rem]`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-slate-950/36 ring-1 ring-inset ring-white/8 sm:h-28 sm:w-28">
              <MoonPhaseCircle
                illuminationFrac={moon.illumination_fraction ?? undefined}
                phaseAngleDeg={moon.phase_angle_deg ?? undefined}
                size={104}
                className="h-[5.5rem] w-[5.5rem] sm:h-[6.2rem] sm:w-[6.2rem]"
                variant="photo"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className={DASHBOARD_METRIC_LABEL_CLASS}>Current phase</div>
              <div className={`${DASHBOARD_VALUE_LARGE_CLASS} text-[1.35rem] sm:text-[1.55rem]`}>
                {moon.phase_name ?? "—"}
              </div>
              <div className="mt-1.5 text-sm text-slate-200/84">
                <span className="text-[1rem] font-semibold text-white">
                  {formatPercent(moon.illumination_percent)}
                </span>{" "}
                illuminated
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${visibilityState.badgeClass}`}
                >
                  {visibilityState.badge}
                </span>
              </div>
            </div>
          </div>

          <div className={DASHBOARD_MUTED_TEXT_CLASS}>
            {visibilityState.detail}
          </div>
        </section>
      </div>
    </div>
  );
}
