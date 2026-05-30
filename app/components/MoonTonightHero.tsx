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
  formatMoonEventDetail,
  getViewingAssessment,
  weatherLabel,
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

function formatDegrees(value: number | null | undefined): string {
  return typeof value === "number" ? `${Math.round(value)}°` : "—";
}

function toCompass(azDeg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const normalized = ((azDeg % 360) + 360) % 360;
  return dirs[Math.round(normalized / 45) % dirs.length];
}

function formatAzimuthWithDirection(azDeg: number | null | undefined): string {
  if (typeof azDeg !== "number") return "Azimuth unavailable";

  const normalized = Math.round(((azDeg % 360) + 360) % 360);
  return `${toCompass(normalized)} (${normalized}°)`;
}

function formatVisibilityLabel(isUp: boolean | null | undefined): string {
  if (isUp === true) return "Above horizon";
  if (isUp === false) return "Below horizon";
  return "Horizon pending";
}

function toEventMs(iso: string | null | undefined): number | null {
  if (!iso) return null;

  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function formatMeridianDirection(lat: number): string {
  return lat >= 0 ? "Southern sky" : "Northern sky";
}

function getBestViewingDirection({
  targetIso,
  lat,
  currentAzimuth,
  currentIsUp,
  moonrise,
  highMoon,
  moonset,
}: {
  targetIso: string | null | undefined;
  lat: number;
  currentAzimuth: number | null | undefined;
  currentIsUp: boolean | null | undefined;
  moonrise: string | null | undefined;
  highMoon: string | null | undefined;
  moonset: string | null | undefined;
}): string | null {
  const targetMs = toEventMs(targetIso);
  const riseMs = toEventMs(moonrise);
  const highMs = toEventMs(highMoon);
  const setMs = toEventMs(moonset);
  const eventProximityMs = 75 * 60 * 1000;

  if (targetMs !== null) {
    if (riseMs !== null && Math.abs(targetMs - riseMs) <= eventProximityMs) {
      return "Eastern sky";
    }

    if (highMs !== null && Math.abs(targetMs - highMs) <= eventProximityMs) {
      return formatMeridianDirection(lat);
    }

    if (setMs !== null && Math.abs(targetMs - setMs) <= eventProximityMs) {
      return "Western sky";
    }

    if (riseMs !== null && highMs !== null && targetMs > riseMs && targetMs < highMs) {
      return "Eastern sky";
    }

    if (highMs !== null && setMs !== null && targetMs > highMs && targetMs < setMs) {
      return "Western sky";
    }
  }

  if (currentIsUp === true && typeof currentAzimuth === "number") {
    return formatAzimuthWithDirection(currentAzimuth);
  }

  return null;
}

function toSentenceClause(value: string): string {
  const trimmed = value.trim().replace(/[.]+$/, "");
  if (!trimmed) return trimmed;
  return `${trimmed[0].toLowerCase()}${trimmed.slice(1)}`;
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
  viewingAssessment,
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
  viewingAssessment: ReturnType<typeof getViewingAssessment>;
  isDarkEnoughForViewing: boolean | null | undefined;
  sunIsUp: boolean | null | undefined;
}) {
  const riseLabel = formatClockTime(moonrise, tz);
  const setLabel = formatClockTime(moonset, tz);
  const highMoonLabel = formatClockTime(highMoon, tz);
  const timeWindowLabel = sunIsUp === true ? "today" : "tonight";
  const weatherClause = toSentenceClause(
    `${weatherOutlookLabel(weatherCondition, weatherCloudCover)} ${timeWindowLabel}`,
  );
  const scheduleClause =
    riseLabel !== "—" && setLabel !== "—"
      ? `Moon rises at ${riseLabel} and sets at ${setLabel}`
      : riseLabel !== "—"
        ? `Moon rises at ${riseLabel}`
        : setLabel !== "—"
          ? `Moon sets at ${setLabel}`
          : "Moon rise and set times are temporarily unavailable";
  const viewingClause = toSentenceClause(viewingAssessment.summary);

  if (viewingAssessment.weatherImpact !== "clear") {
    if (isDarkEnoughForViewing === false) {
      const twilightHint = buildVisibilitySuggestion({
        sunIsUp,
        nauticalDawn,
        nauticalDusk,
        tz,
      })
        .replace(/^Moon should be visible around /, "better viewing begins around ")
        .replace(/[.]+$/, "");
      const recoveryHint =
        viewingAssessment.weatherImpact === "poor" ? "if skies clear" : "if clouds thin";

      return `${scheduleClause} under ${weatherClause}, but ${viewingClause} and ${toSentenceClause(twilightHint)} ${recoveryHint}.`;
    }

    return `${scheduleClause} under ${weatherClause}, but ${viewingClause}.`;
  }

  if (isDarkEnoughForViewing === true) {
    return highMoonLabel !== "—"
      ? `${scheduleClause} under ${weatherClause}, with good viewing around peak altitude at ${highMoonLabel}.`
      : `${scheduleClause} under ${weatherClause}, with good viewing conditions later ${timeWindowLabel}.`;
  }

  if (isDarkEnoughForViewing === false) {
    const twilightHint = buildVisibilitySuggestion({
      sunIsUp,
      nauticalDawn,
      nauticalDusk,
      tz,
    }).replace(/^Moon should be visible around /, "with better viewing around ");

    return `${scheduleClause} under ${weatherClause}, but ${viewingClause} and ${toSentenceClause(twilightHint)}.`;
  }

  return `${scheduleClause} under ${weatherClause}, and ${viewingClause}.`;
}

function formatWeatherContext(
  condition: WeatherCondition | undefined,
  cloudCoverPct: number | undefined,
) {
  const conditionLabel = weatherLabel(condition);

  return typeof cloudCoverPct === "number"
    ? `${conditionLabel} · ${Math.round(cloudCoverPct)}% cloud cover`
    : conditionLabel;
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

function formatBestViewing({
  nauticalDusk,
  isDarkEnoughForViewing,
  nextTransition,
  weatherCondition,
  weatherCloudCover,
  viewingAssessment,
  lat,
  currentAzimuth,
  currentIsUp,
  moonrise,
  highMoon,
  moonset,
  tz,
}: {
  nauticalDusk: string | null | undefined;
  isDarkEnoughForViewing: boolean | null | undefined;
  nextTransition: string | null | undefined;
  weatherCondition: WeatherCondition | undefined;
  weatherCloudCover: number | undefined;
  viewingAssessment: ReturnType<typeof getViewingAssessment>;
  lat: number;
  currentAzimuth: number | null | undefined;
  currentIsUp: boolean | null | undefined;
  moonrise: string | null | undefined;
  highMoon: string | null | undefined;
  moonset: string | null | undefined;
  tz: string;
}) {
  const weatherContext = formatWeatherContext(weatherCondition, weatherCloudCover);
  const nextDarkIso = nauticalDusk ?? nextTransition;
  const nextDarkLabel = formatClockTime(nextDarkIso, tz);
  const currentDirection = getBestViewingDirection({
    targetIso: null,
    lat,
    currentAzimuth,
    currentIsUp,
    moonrise,
    highMoon,
    moonset,
  });
  const nextDarkDirection = getBestViewingDirection({
    targetIso: nextDarkIso,
    lat,
    currentAzimuth,
    currentIsUp,
    moonrise,
    highMoon,
    moonset,
  });

  if (viewingAssessment.weatherImpact === "poor") {
    if (isDarkEnoughForViewing === true) {
      return {
        label: "Best viewing",
        value: "If skies clear",
        direction: currentDirection,
        detail: weatherContext,
      };
    }

    if (nextDarkLabel !== "—") {
      return {
        label: "Best viewing",
        value: `After ${nextDarkLabel.replace(/\s+[A-Z]{2,5}$/, "")}`,
        direction: nextDarkDirection,
        detail: "If skies clear",
      };
    }

    return {
      label: "Best viewing",
      value: "If skies clear",
      direction: currentDirection,
      detail: weatherContext,
    };
  }

  if (viewingAssessment.weatherImpact === "limited") {
    if (isDarkEnoughForViewing === true) {
      return {
        label: "Best viewing",
        value: "If clouds thin",
        direction: currentDirection,
        detail: weatherContext,
      };
    }

    if (nextDarkLabel !== "—") {
      return {
        label: "Best viewing",
        value: `After ${nextDarkLabel.replace(/\s+[A-Z]{2,5}$/, "")}`,
        direction: nextDarkDirection,
        detail: "If clouds thin",
      };
    }

    return {
      label: "Best viewing",
      value: "If clouds thin",
      direction: currentDirection,
      detail: weatherContext,
    };
  }

  if (isDarkEnoughForViewing === true) {
    return {
      label: "Best viewing",
      value: "Now",
      direction: currentDirection,
      detail: "Dark enough for viewing.",
    };
  }

  if (nextDarkLabel !== "—") {
    return {
      label: "Best viewing",
      value: `After ${nextDarkLabel.replace(/\s+[A-Z]{2,5}$/, "")}`,
      direction: nextDarkDirection,
      detail: "Nautical twilight",
    };
  }

  return {
    label: "Best viewing",
    value: "Unavailable",
    direction: null,
    detail: "Next dark window unavailable.",
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
        minHeightClass="min-h-[16rem] md:min-h-[15rem]"
      />
    );
  }

  if (!summaryQ.data) {
    return (
      <div className={`${DASHBOARD_PANEL_CLASS} min-h-[16rem] gap-3.5 md:min-h-[15rem] md:gap-2.5`}>
        <DashboardSkeletonBlock className="h-2 w-32 rounded-full" />

        <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(13rem,0.78fr)] md:gap-2.5 md:items-start">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-start">
              <DashboardSkeletonBlock className="h-[5.5rem] rounded-[1.1rem]" />
              <DashboardSkeletonBlock className="h-[4.75rem] rounded-[1rem]" />
            </div>
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
  const viewingAssessment = getViewingAssessment({
    isDarkEnoughForViewing: summary.visibility.is_dark_enough_for_viewing,
    visibilitySummary: summary.visibility.summary,
    weatherCondition: weatherQ.data?.condition,
    weatherCloudCover: weatherQ.data?.cloudCoverPct,
  });
  const skySummary = buildSkySummary({
    moonrise: moon.moonrise,
    moonset: moon.moonset,
    highMoon: moon.high_moon,
    nauticalDawn: summary.twilight.nautical_dawn,
    nauticalDusk: summary.twilight.nautical_dusk,
    tz,
    weatherCondition: weatherQ.data?.condition,
    weatherCloudCover: weatherQ.data?.cloudCoverPct,
    viewingAssessment,
    isDarkEnoughForViewing: summary.visibility.is_dark_enough_for_viewing,
    sunIsUp: summary.sun.is_up,
  });
  const bestViewing = formatBestViewing({
    nauticalDusk: summary.twilight.nautical_dusk,
    isDarkEnoughForViewing: summary.visibility.is_dark_enough_for_viewing,
    nextTransition: summary.twilight.next_transition,
    weatherCondition: weatherQ.data?.condition,
    weatherCloudCover: weatherQ.data?.cloudCoverPct,
    viewingAssessment,
    lat,
    currentAzimuth: moon.azimuth_deg,
    currentIsUp: moon.is_up,
    moonrise: moon.moonrise,
    highMoon: moon.high_moon,
    moonset: moon.moonset,
    tz,
  });
  const timingItems = [
    {
      label: "Moonrise",
      value: formatClockTime(moon.moonrise, tz),
      detail: formatMoonEventDetail("moonrise"),
    },
    {
      label: "Moon altitude",
      value: formatDegrees(moon.altitude_deg),
      detail: `${formatAzimuthWithDirection(moon.azimuth_deg)} · ${formatVisibilityLabel(moon.is_up)}`,
    },
    {
      label: "Moonset",
      value: formatClockTime(moon.moonset, tz),
      detail: formatMoonEventDetail("moonset"),
    },
  ];

  return (
    <div className={`${DASHBOARD_PANEL_CLASS} min-h-[16rem] gap-3.5 md:min-h-[15rem] md:gap-2.5`}>
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

      <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(13rem,0.78fr)] md:gap-2.5 md:items-start">
        <section className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-start">
            <p className="max-w-[64ch] text-[14px] font-medium leading-6 text-slate-50/94 sm:text-[15px]">
              {skySummary}
            </p>

            <div className="min-w-0 border-t border-white/7 pt-3 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
              <div className={DASHBOARD_METRIC_LABEL_CLASS}>{bestViewing.label}</div>
              <div className={`${DASHBOARD_VALUE_CLASS} text-[1rem] leading-tight`}>
                {bestViewing.value}
              </div>
              {bestViewing.direction ? (
                <div className="mt-1 text-[12px] font-medium leading-tight text-slate-100/92 sm:text-[13px]">
                  {bestViewing.direction}
                </div>
              ) : null}
              <div className={`mt-1 ${DASHBOARD_MUTED_TEXT_CLASS}`}>
                {bestViewing.detail}
              </div>
            </div>
          </div>

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
          className={`${DASHBOARD_SURFACE_CLASS} flex flex-col justify-center gap-2.5 px-3 py-3 md:min-h-[10.25rem]`}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-[5.5rem] w-[5.5rem] shrink-0 items-center justify-center rounded-full bg-slate-950/36 ring-1 ring-inset ring-white/8 sm:h-24 sm:w-24">
              <MoonPhaseCircle
                illuminationFrac={moon.illumination_fraction ?? undefined}
                phaseAngleDeg={moon.phase_angle_deg ?? undefined}
                size={96}
                className="h-[5rem] w-[5rem] sm:h-[5.5rem] sm:w-[5.5rem]"
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
