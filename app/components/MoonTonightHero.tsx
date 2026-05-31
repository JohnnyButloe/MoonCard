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
  DASHBOARD_METRIC_LABEL_CLASS,
  DASHBOARD_MUTED_TEXT_CLASS,
  DASHBOARD_PANEL_CLASS,
  DASHBOARD_PANEL_EYEBROW_CLASS,
  DASHBOARD_VALUE_LARGE_CLASS,
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

function toCompass(azDeg: number): string {
  const dirs = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  const normalized = ((azDeg % 360) + 360) % 360;
  return dirs[Math.round(normalized / 45) % dirs.length];
}

function formatDirectionWord(azDeg: number | null | undefined): string | null {
  if (typeof azDeg !== "number") return null;
  return toCompass(azDeg);
}

function getLocalHour(iso: string | null | undefined, tz: string): number | null {
  if (!iso) return null;

  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: tz,
  }).formatToParts(d);
  const hourPart = parts.find((part) => part.type === "hour")?.value;
  const hour = hourPart ? Number.parseInt(hourPart, 10) : Number.NaN;

  return Number.isFinite(hour) ? hour : null;
}

function formatDirectionDetail(direction: string | null, detail: string): string {
  if (!direction) return detail;
  return `Look ${direction} · ${detail}`;
}

function formatStatusHelper(
  status: string,
  bestViewingValue: string,
): string {
  if (status === "Visible now") {
    if (bestViewingValue.startsWith("After ")) {
      return "Viewing may change as daylight fades.";
    }
    if (bestViewingValue === "Now") return "Good viewing right now.";
    return "Visibility may change through the night.";
  }

  if (status === "Below horizon") {
    if (bestViewingValue.startsWith("After ")) return "Best viewing later tonight.";
    if (bestViewingValue === "If skies clear") return "Wait for a clearer window.";
    if (bestViewingValue === "If clouds thin") return "Wait for thinner clouds.";
    return "Watching for the next window.";
  }

  return "Status is updating.";
}

function formatMoonriseHelper(): string {
  return "Rises in the east.";
}

function formatMoonsetHelper(
  iso: string | null | undefined,
  tz: string,
): string {
  const localHour = getLocalHour(iso, tz);

  if (localHour !== null && localHour < 6) {
    return "Sets before dawn.";
  }

  return "Sets in the west.";
}

function toEventMs(iso: string | null | undefined): number | null {
  if (!iso) return null;

  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function formatMeridianDirection(lat: number): string {
  return lat >= 0 ? "south" : "north";
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
      return "east";
    }

    if (highMs !== null && Math.abs(targetMs - highMs) <= eventProximityMs) {
      return formatMeridianDirection(lat);
    }

    if (setMs !== null && Math.abs(targetMs - setMs) <= eventProximityMs) {
      return "west";
    }

    if (riseMs !== null && highMs !== null && targetMs > riseMs && targetMs < highMs) {
      return "east";
    }

    if (highMs !== null && setMs !== null && targetMs > highMs && targetMs < setMs) {
      return "west";
    }
  }

  if (currentIsUp === true && typeof currentAzimuth === "number") {
    return formatDirectionWord(currentAzimuth);
  }

  return null;
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
      badgeClass: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100/90",
    };
  }

  if (isUp === false) {
    return {
      badge: "Below horizon",
      badgeClass: "border-white/10 bg-white/[0.04] text-slate-200/82",
    };
  }

  return {
    badge: "Status pending",
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
        label: "Best viewing tonight",
        value: "If skies clear",
        direction: currentDirection,
        detail: weatherContext,
      };
    }

    if (nextDarkLabel !== "—") {
      return {
        label: "Best viewing tonight",
        value: `After ${nextDarkLabel.replace(/\s+[A-Z]{2,5}$/, "")}`,
        direction: nextDarkDirection,
        detail: "If skies clear",
      };
    }

    return {
      label: "Best viewing tonight",
      value: "If skies clear",
      direction: currentDirection,
      detail: weatherContext,
    };
  }

  if (viewingAssessment.weatherImpact === "limited") {
    if (isDarkEnoughForViewing === true) {
      return {
        label: "Best viewing tonight",
        value: "If clouds thin",
        direction: currentDirection,
        detail: weatherContext,
      };
    }

    if (nextDarkLabel !== "—") {
      return {
        label: "Best viewing tonight",
        value: `After ${nextDarkLabel.replace(/\s+[A-Z]{2,5}$/, "")}`,
        direction: nextDarkDirection,
        detail: "If clouds thin",
      };
    }

    return {
      label: "Best viewing tonight",
      value: "If clouds thin",
      direction: currentDirection,
      detail: weatherContext,
    };
  }

  if (isDarkEnoughForViewing === true) {
    return {
      label: "Best viewing tonight",
      value: "Now",
      direction: currentDirection,
      detail: "Dark enough for viewing.",
    };
  }

  if (nextDarkLabel !== "—") {
    return {
      label: "Best viewing tonight",
      value: `After ${nextDarkLabel.replace(/\s+[A-Z]{2,5}$/, "")}`,
      direction: nextDarkDirection,
      detail: "Nautical twilight",
    };
  }

  return {
    label: "Best viewing tonight",
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
        minHeightClass="min-h-[12rem]"
      />
    );
  }

  if (!summaryQ.data) {
    return (
      <div className={`${DASHBOARD_PANEL_CLASS} min-h-[12rem] gap-2`}>
        <DashboardSkeletonBlock className="h-2 w-20 rounded-full" />

        <div className="grid flex-1 min-h-0 grid-cols-[minmax(0,1fr)_7.5rem] gap-3 sm:grid-cols-[minmax(0,1fr)_8.7rem] sm:gap-4">
          <div className="flex min-h-0 min-w-0 flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(9.5rem,0.9fr)] sm:gap-4">
              <div className="space-y-2">
                <DashboardSkeletonBlock className="h-7 w-44 rounded-xl" />
                <DashboardSkeletonBlock className="h-4 w-48 rounded-full" />
              </div>

              <div className="space-y-2">
                <DashboardSkeletonBlock className="h-2 w-28 rounded-full" />
                <DashboardSkeletonBlock className="h-6 w-28 rounded-xl" />
                <DashboardSkeletonBlock className="h-3 w-36 rounded-full" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 border-t border-white/7 pt-2 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`moon-tonight-detail-skeleton-${index}`} className="space-y-2">
                  <DashboardSkeletonBlock className="h-2 w-16 rounded-full" />
                  <DashboardSkeletonBlock className="h-5 w-20 rounded-xl" />
                  <DashboardSkeletonBlock className="h-3 w-24 rounded-full" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex h-full items-center justify-end">
            <DashboardSkeletonBlock className="h-[7.9rem] w-[7.9rem] rounded-full sm:h-[8.75rem] sm:w-[8.75rem]" />
          </div>
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
  const horizonItems = [
    {
      label: "Moonrise",
      value: formatClockTime(moon.moonrise, tz),
      detail: formatMoonriseHelper(),
    },
    {
      label: "Moonset",
      value: formatClockTime(moon.moonset, tz),
      detail: formatMoonsetHelper(moon.moonset, tz),
    },
  ].filter((item) => item.value !== "—");
  const statusValue = visibilityState.badge;
  const statusDetail = formatStatusHelper(statusValue, bestViewing.value);
  const metadataParts = [
    `${formatPercent(moon.illumination_percent)} illuminated`,
    statusValue,
  ].filter(Boolean);
  const bestViewingHelper = formatDirectionDetail(bestViewing.direction, bestViewing.detail);

  return (
    <div className={`${DASHBOARD_PANEL_CLASS} min-h-[12rem] gap-2`}>
      <header className="min-w-0">
        <p className={DASHBOARD_PANEL_EYEBROW_CLASS}>Moon now</p>
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

      <div className="grid flex-1 min-h-0 grid-cols-[minmax(0,1fr)_7.5rem] gap-3 sm:grid-cols-[minmax(0,1fr)_8.7rem] sm:gap-4">
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <section className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(9.5rem,0.9fr)] sm:gap-4">
            <div className="min-w-0 space-y-1.5">
              <div className={`${DASHBOARD_VALUE_LARGE_CLASS} mt-0 text-[1.56rem] leading-[1.02] sm:text-[1.8rem]`}>
                {moon.phase_name ?? "—"}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-slate-200/84 sm:text-[13px]">
                {metadataParts.map((part, index) => (
                  <span key={part} className="inline-flex items-center gap-2">
                    {index > 0 ? <span className="text-slate-400/55">·</span> : null}
                    <span className={index === 0 ? "font-medium text-slate-100" : "font-medium text-slate-200/88"}>
                      {part}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            <div className="min-w-0 space-y-1 sm:pt-0.5">
              <div className={DASHBOARD_METRIC_LABEL_CLASS}>{bestViewing.label}</div>
              <div className="text-[1.12rem] font-semibold leading-tight text-slate-100 sm:text-[1.24rem]">
                {bestViewing.value}
              </div>
              <div className="text-[11.5px] font-medium leading-tight text-slate-100/88 sm:text-[12px]">
                {bestViewingHelper}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2.5 border-t border-white/7 pt-2 sm:grid-cols-3">
            {[
              ...horizonItems,
              {
                label: "Now",
                value: statusValue,
                detail: statusDetail,
              },
            ].map((item) => (
              <div key={item.label} className="min-w-0">
                <div className={DASHBOARD_METRIC_LABEL_CLASS}>{item.label}</div>
                <div className="mt-1 text-[0.95rem] font-semibold leading-tight text-slate-100 sm:text-[1rem]">
                  {item.value}
                </div>
                <div className={`mt-1 leading-snug ${DASHBOARD_MUTED_TEXT_CLASS}`}>
                  {item.detail}
                </div>
              </div>
            ))}
          </section>
        </div>

        <div className="flex h-full items-center justify-end">
          <div className="flex h-[7.9rem] w-[7.9rem] shrink-0 items-center justify-center rounded-full bg-slate-950/36 ring-1 ring-inset ring-white/8 sm:h-[8.75rem] sm:w-[8.75rem]">
            <MoonPhaseCircle
              illuminationFrac={moon.illumination_fraction ?? undefined}
              phaseAngleDeg={moon.phase_angle_deg ?? undefined}
              size={148}
              className="h-[7.2rem] w-[7.2rem] sm:h-[7.95rem] sm:w-[7.95rem]"
              variant="photo"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
