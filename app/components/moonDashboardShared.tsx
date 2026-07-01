"use client";

import type {
  MoonCardMoonData,
  MoonCardSunData,
  MoonCardTwilightData,
} from "../lib/mooncard/types";
import type { WeatherCondition } from "../providers/weather";

export const DASHBOARD_PAGE_CLASS =
  "min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.09),_rgba(5,8,22,0.36)_24%,_#050816_58%,_#040712_100%)] text-slate-100";

export const DASHBOARD_PAGE_SHELL_CLASS =
  "relative mx-auto max-w-[1240px] px-4 py-3 sm:px-5 sm:py-4 xl:px-6 xl:py-5";

export const DASHBOARD_SECTION_CLASS =
  "rounded-[1.75rem] border border-white/7 bg-[linear-gradient(180deg,rgba(15,23,42,0.68),rgba(2,6,23,0.78))] p-3.5 shadow-[0_18px_40px_rgba(2,6,23,0.26)] ring-1 ring-white/6 backdrop-blur-md sm:p-4";

export const DASHBOARD_SECTION_HEADER_CLASS =
  "mb-3 border-b border-white/7 pb-2.5 sm:mb-3.5";

export const DASHBOARD_SECTION_TITLE_CLASS =
  "text-[1.02rem] font-semibold tracking-tight text-slate-50 sm:text-[1.08rem]";

export const DASHBOARD_PANEL_CLASS =
  "flex h-full w-full flex-col gap-3 rounded-[1.5rem] border border-white/7 bg-[linear-gradient(180deg,rgba(15,23,42,0.74),rgba(2,6,23,0.84))] p-4 shadow-[0_16px_34px_rgba(2,6,23,0.24)] ring-1 ring-white/6 backdrop-blur-md";

export const DASHBOARD_PANEL_HEADER_CLASS =
  "flex items-start justify-between gap-3";

export const DASHBOARD_PANEL_EYEBROW_CLASS =
  "text-[10px] uppercase tracking-[0.24em] text-sky-200/50";

export const DASHBOARD_PANEL_TITLE_CLASS =
  "mt-1 text-sm font-semibold tracking-tight text-slate-50";

export const DASHBOARD_VALUE_CLASS =
  "mt-1 text-sm font-semibold text-slate-100";

export const DASHBOARD_VALUE_LARGE_CLASS =
  "mt-1 text-[1.45rem] font-semibold leading-tight text-slate-50 sm:text-[1.6rem]";

export const DASHBOARD_SURFACE_CLASS =
  "rounded-[1.1rem] bg-white/[0.035] px-3.5 py-3 ring-1 ring-inset ring-white/7";

export const DASHBOARD_HERO_SURFACE_CLASS =
  "rounded-[1.2rem] bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_rgba(15,23,42,0.6)_42%,_rgba(2,6,23,0.88)_100%)] px-3.5 py-3.5 ring-1 ring-inset ring-sky-200/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

export const DASHBOARD_METRIC_TILE_CLASS =
  "rounded-[1rem] bg-white/[0.028] px-3 py-2.5 ring-1 ring-inset ring-white/7";

export const DASHBOARD_METRIC_LABEL_CLASS =
  "text-[10px] uppercase tracking-[0.18em] text-slate-300/60";

export const DASHBOARD_MUTED_TEXT_CLASS =
  "text-[11px] text-slate-300/66";

export const DASHBOARD_SUPPORT_TEXT_CLASS =
  "mt-1 text-[11px] leading-relaxed text-slate-300/70";

export const DASHBOARD_BADGE_CLASS =
  "inline-flex items-center rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-100";

export const DASHBOARD_BADGE_MUTED_CLASS =
  "inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-200/78";

export const DASHBOARD_ICON_BADGE_CLASS =
  "flex h-9 w-9 items-center justify-center rounded-full bg-slate-950/48 ring-1 ring-inset ring-white/8";

export const DASHBOARD_META_FOOTER_CLASS =
  "mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-white/7 pt-2.5 text-[10px] text-slate-400/68";

export type ViewingWeatherImpact = "clear" | "limited" | "poor";
export type ViewingAssessment = {
  label: string;
  summary: string;
  weatherImpact: ViewingWeatherImpact;
};

export type LunarVisibilityState = {
  code:
    | "visible_now"
    | "likely_visible_near_sunset"
    | "daylight_limited"
    | "not_visible"
    | "status_pending";
  badge: string;
  label: string;
  detail: string;
  badgeClass: string;
};

// Below about 8 degrees, haze and horizon clutter make the moon easy to lose
// even when the sky is otherwise dark.
const MIN_MOON_ALTITUDE_FOR_DARK_SKY_VISIBILITY_DEG = 8;
// Thin crescents can still be visible at night, but we keep a small floor to
// avoid over-promising the faintest cases.
const MIN_MOON_ILLUMINATION_FOR_DARK_SKY_VISIBILITY_PCT = 6;
// Once the sun climbs above roughly golden-hour altitude, daytime contrast is
// usually too low to confidently claim the moon is visible.
const MAX_SUN_ALTITUDE_FOR_QUALIFIED_DAYLIGHT_VISIBILITY_DEG = 6;
// Daylight viewing needs the moon comfortably above the horizon haze.
const MIN_MOON_ALTITUDE_FOR_LOW_SUN_VISIBILITY_DEG = 14;
// Near sunset, a modestly lit moon is realistic; dimmer crescents are often
// too subtle to promise in bright sky.
const MIN_MOON_ILLUMINATION_FOR_LOW_SUN_VISIBILITY_PCT = 18;

export function formatMoonEventDetail(
  event: "moonrise" | "high_moon" | "moonset",
): string {
  switch (event) {
    case "moonrise":
      return "Rises in the eastern sky.";
    case "moonset":
      return "Sets in the western sky.";
    case "high_moon":
    default:
      return "Highest point in the sky.";
  }
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function resolveLunarVisibilityContext({
  sunAltitudeDeg,
  sunIsUp,
  twilightPhase,
  isDarkEnoughForViewing,
}: {
  sunAltitudeDeg: number | null | undefined;
  sunIsUp: boolean | null | undefined;
  twilightPhase: string | null | undefined;
  isDarkEnoughForViewing: boolean | null | undefined;
}): "dark" | "low_sun_daylight" | "bright_daylight" | "unknown" {
  if (isFiniteNumber(sunAltitudeDeg)) {
    if (sunAltitudeDeg < 0) return "dark";
    if (sunAltitudeDeg <= MAX_SUN_ALTITUDE_FOR_QUALIFIED_DAYLIGHT_VISIBILITY_DEG) {
      return "low_sun_daylight";
    }
    return "bright_daylight";
  }

  const normalizedTwilightPhase = (twilightPhase ?? "").toLowerCase();
  if (
    normalizedTwilightPhase === "dark" ||
    normalizedTwilightPhase === "astronomical" ||
    normalizedTwilightPhase === "nautical" ||
    normalizedTwilightPhase === "civil"
  ) {
    return "dark";
  }

  if (sunIsUp === false || isDarkEnoughForViewing === true) {
    return "dark";
  }

  if (sunIsUp === true || normalizedTwilightPhase === "day") {
    return "bright_daylight";
  }

  if (isDarkEnoughForViewing === false) {
    return "bright_daylight";
  }

  return "unknown";
}

function meetsVisibilityThresholds({
  altitudeDeg,
  illuminationPercent,
  minAltitudeDeg,
  minIlluminationPercent,
}: {
  altitudeDeg: number | null | undefined;
  illuminationPercent: number | null | undefined;
  minAltitudeDeg: number;
  minIlluminationPercent: number;
}) {
  return (
    isFiniteNumber(altitudeDeg) &&
    altitudeDeg >= minAltitudeDeg &&
    isFiniteNumber(illuminationPercent) &&
    illuminationPercent >= minIlluminationPercent
  );
}

export function getLunarVisibilityState({
  moon,
  sun,
  twilight,
  isDarkEnoughForViewing,
}: {
  moon: Pick<
    MoonCardMoonData,
    "is_up" | "altitude_deg" | "illumination_percent"
  >;
  sun: Pick<MoonCardSunData, "altitude_deg" | "is_up">;
  twilight: Pick<MoonCardTwilightData, "current_phase">;
  isDarkEnoughForViewing: boolean | null | undefined;
}): LunarVisibilityState {
  if (moon.is_up === false) {
    return {
      code: "not_visible",
      badge: "Below horizon",
      label: "Not visible right now",
      detail: "Moon is below the horizon.",
      badgeClass: "border-white/10 bg-white/[0.04] text-slate-200/82",
    };
  }

  if (moon.is_up !== true) {
    return {
      code: "status_pending",
      badge: "Status pending",
      label: "Visibility updating",
      detail: "Viewing guidance is updating.",
      badgeClass: "border-white/10 bg-white/[0.04] text-slate-200/82",
    };
  }

  const context = resolveLunarVisibilityContext({
    sunAltitudeDeg: sun.altitude_deg,
    sunIsUp: sun.is_up,
    twilightPhase: twilight.current_phase,
    isDarkEnoughForViewing,
  });

  if (
    context !== "bright_daylight" &&
    (!isFiniteNumber(moon.altitude_deg) ||
      !isFiniteNumber(moon.illumination_percent))
  ) {
    return {
      code: "status_pending",
      badge: "Status pending",
      label: "Visibility updating",
      detail: "Viewing guidance is updating.",
      badgeClass: "border-white/10 bg-white/[0.04] text-slate-200/82",
    };
  }

  if (context === "dark") {
    if (
      meetsVisibilityThresholds({
        altitudeDeg: moon.altitude_deg,
        illuminationPercent: moon.illumination_percent,
        minAltitudeDeg: MIN_MOON_ALTITUDE_FOR_DARK_SKY_VISIBILITY_DEG,
        minIlluminationPercent: MIN_MOON_ILLUMINATION_FOR_DARK_SKY_VISIBILITY_PCT,
      })
    ) {
      return {
        code: "visible_now",
        badge: "Visible now",
        label: "Visible now",
        detail: "Dark enough to spot if skies are clear.",
        badgeClass:
          "border-emerald-300/20 bg-emerald-300/10 text-emerald-100/90",
      };
    }

    return {
      code: "not_visible",
      badge: "Low contrast",
      label: "Not visible right now",
      detail: "Above horizon, but it is still low-contrast right now.",
      badgeClass: "border-white/10 bg-white/[0.04] text-slate-200/82",
    };
  }

  if (context === "low_sun_daylight") {
    if (
      meetsVisibilityThresholds({
        altitudeDeg: moon.altitude_deg,
        illuminationPercent: moon.illumination_percent,
        minAltitudeDeg: MIN_MOON_ALTITUDE_FOR_LOW_SUN_VISIBILITY_DEG,
        minIlluminationPercent: MIN_MOON_ILLUMINATION_FOR_LOW_SUN_VISIBILITY_PCT,
      })
    ) {
      return {
        code: "likely_visible_near_sunset",
        badge: "Near sunset",
        label: "Likely visible near sunset",
        detail: "Low sun improves contrast if skies are clear.",
        badgeClass: "border-amber-300/20 bg-amber-300/10 text-amber-100/90",
      };
    }

    return {
      code: "daylight_limited",
      badge: "Daylight limited",
      label: "Not visible right now",
      detail: "Above horizon, but daylight limits visibility.",
      badgeClass: "border-white/10 bg-white/[0.04] text-slate-200/82",
    };
  }

  if (context === "bright_daylight") {
    return {
      code: "daylight_limited",
      badge: "Daylight limited",
      label: "Not visible right now",
      detail: "Above horizon, but daylight limits visibility.",
      badgeClass: "border-white/10 bg-white/[0.04] text-slate-200/82",
    };
  }

  return {
    code: "status_pending",
    badge: "Status pending",
    label: "Visibility updating",
    detail: "Viewing guidance is updating.",
    badgeClass: "border-white/10 bg-white/[0.04] text-slate-200/82",
  };
}

export type TwilightWindowPhase = "civil" | "nautical" | "astronomical";

export type TwilightWindowFrame = {
  key: "sunrise" | "sunset";
  label: "Sunrise" | "Sunset";
  startIso: string | null | undefined;
  endIso: string | null | undefined;
};

export function formatClockTime(
  iso: string | null | undefined,
  tz: string,
): string {
  if (!iso) return "—";

  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  }).format(d);
}

export function formatClockRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  tz: string,
  separator = " - ",
): string {
  const start = formatClockTime(startIso, tz);
  const end = formatClockTime(endIso, tz);

  if (start === "—" && end === "—") return "—";
  return `${start}${separator}${end}`;
}

export function buildTwilightWindowFrames(
  twilight: Pick<
    MoonCardTwilightData,
    | "civil_dawn"
    | "civil_dusk"
    | "nautical_dawn"
    | "nautical_dusk"
    | "astronomical_dawn"
    | "astronomical_dusk"
  >,
  sun: Pick<MoonCardSunData, "sunrise" | "sunset">,
): Record<TwilightWindowPhase, [TwilightWindowFrame, TwilightWindowFrame]> {
  return {
    civil: [
      {
        key: "sunrise",
        label: "Sunrise",
        startIso: twilight.civil_dawn,
        endIso: sun.sunrise,
      },
      {
        key: "sunset",
        label: "Sunset",
        startIso: sun.sunset,
        endIso: twilight.civil_dusk,
      },
    ],
    nautical: [
      {
        key: "sunrise",
        label: "Sunrise",
        startIso: twilight.nautical_dawn,
        endIso: twilight.civil_dawn,
      },
      {
        key: "sunset",
        label: "Sunset",
        startIso: twilight.civil_dusk,
        endIso: twilight.nautical_dusk,
      },
    ],
    astronomical: [
      {
        key: "sunrise",
        label: "Sunrise",
        startIso: twilight.astronomical_dawn,
        endIso: twilight.nautical_dawn,
      },
      {
        key: "sunset",
        label: "Sunset",
        startIso: twilight.nautical_dusk,
        endIso: twilight.astronomical_dusk,
      },
    ],
  };
}

export function formatTwilightWindowSummary(
  frames: readonly TwilightWindowFrame[],
  tz: string,
): string {
  const ranges = frames
    .map((frame) => formatClockRange(frame.startIso, frame.endIso, tz))
    .filter((value) => value !== "—");

  if (ranges.length === 0) return "—";
  return ranges.join(" / ");
}

export function formatLocalTime(iso: string | undefined, tz: string): string {
  if (!iso) return "—";

  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
    timeZoneName: "short",
  }).format(d);
}

export function formatLocalDate(iso: string | undefined, tz: string): string {
  if (!iso) return "—";

  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: tz,
  }).format(d);
}

export function formatTimeOrDateTime(iso: string | undefined, tz: string): string {
  if (!iso) return "—";

  const eventDate = new Date(iso);
  if (!Number.isFinite(eventDate.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  }).format(eventDate);
}

export function weatherLabel(condition: WeatherCondition | undefined): string {
  switch (condition) {
    case "clear":
      return "Clear";
    case "partly_cloudy":
      return "Partly cloudy";
    case "overcast":
      return "Overcast";
    case "rain":
      return "Rain";
    case "snow":
      return "Snow";
    case "storm":
      return "Storm";
    case "fog":
      return "Fog";
    default:
      return "Weather";
  }
}

export function getViewingWeatherImpact(
  condition: WeatherCondition | undefined,
  cloudCoverPct: number | undefined,
): ViewingWeatherImpact {
  if (condition === "storm" || condition === "snow" || condition === "overcast") {
    return "poor";
  }

  if (typeof cloudCoverPct === "number") {
    if (cloudCoverPct >= 90) return "poor";
    if (cloudCoverPct >= 55) return "limited";
  }

  if (condition === "rain") {
    return typeof cloudCoverPct === "number" && cloudCoverPct < 55
      ? "limited"
      : "poor";
  }

  if (condition === "fog" || condition === "partly_cloudy") {
    return "limited";
  }

  return "clear";
}

function weatherViewingReason(
  condition: WeatherCondition | undefined,
  cloudCoverPct: number | undefined,
  impact: ViewingWeatherImpact,
): string | null {
  switch (condition) {
    case "overcast":
      return "Overcast skies will likely block the moon.";
    case "storm":
      return "Storm conditions will likely block the moon.";
    case "snow":
      return "Snow clouds will likely block the moon.";
    case "rain":
      return impact === "poor"
        ? "Rain clouds will likely block the moon."
        : "Rain clouds may reduce visibility.";
    case "fog":
      return impact === "poor"
        ? "Fog will likely block visibility."
        : "Fog may reduce visibility.";
    case "partly_cloudy":
      return "Clouds may interrupt visibility.";
    default:
      break;
  }

  if (typeof cloudCoverPct === "number") {
    if (cloudCoverPct >= 90) return "Heavy cloud cover will likely block the moon.";
    if (cloudCoverPct >= 55) return "Cloud cover may reduce visibility.";
  }

  return null;
}

export function getViewingAssessment({
  isDarkEnoughForViewing,
  visibilitySummary,
  weatherCondition,
  weatherCloudCover,
}: {
  isDarkEnoughForViewing: boolean | null | undefined;
  visibilitySummary: string | null | undefined;
  weatherCondition: WeatherCondition | undefined;
  weatherCloudCover: number | undefined;
}): ViewingAssessment {
  const weatherImpact = getViewingWeatherImpact(weatherCondition, weatherCloudCover);
  const weatherReason = weatherViewingReason(
    weatherCondition,
    weatherCloudCover,
    weatherImpact,
  );

  if (weatherImpact === "poor") {
    if (isDarkEnoughForViewing === false) {
      return {
        label: "Poor viewing",
        summary:
          weatherReason ??
          "The sky is bright and weather conditions will likely block the moon.",
        weatherImpact,
      };
    }

    return {
      label: "Poor viewing",
      summary:
        weatherReason ??
        "Weather conditions will likely block the moon despite dark skies.",
      weatherImpact,
    };
  }

  if (weatherImpact === "limited") {
    if (isDarkEnoughForViewing === false) {
      return {
        label: "Limited viewing",
        summary:
          weatherReason ??
          "The sky is bright and clouds may further reduce visibility.",
        weatherImpact,
      };
    }

    return {
      label: "Limited viewing",
      summary: weatherReason ?? "Clouds may interrupt visibility.",
      weatherImpact,
    };
  }

  if (isDarkEnoughForViewing === true) {
    return {
      label: "Good viewing",
      summary:
        visibilitySummary ?? "Dark sky conditions are available for viewing.",
      weatherImpact,
    };
  }

  if (isDarkEnoughForViewing === false) {
    return {
      label: "Bright sky",
      summary:
        visibilitySummary ?? "The sky is not dark enough for easy viewing.",
      weatherImpact,
    };
  }

  return {
    label: "Viewing unknown",
    summary:
      visibilitySummary ?? "Viewing guidance is unavailable for this update.",
    weatherImpact,
  };
}

export function WeatherCloudSymbol({
  condition,
  size = 28,
}: {
  condition: WeatherCondition | undefined;
  size?: number;
}) {
  const stroke = "rgba(226,232,240,0.92)";
  const baseCloud = (
    <path
      d="M17 41h30a8.5 8.5 0 0 0 0-17 13.5 13.5 0 0 0-25.8-3.9A9.5 9.5 0 0 0 17 41Z"
      fill="rgba(148,163,184,0.2)"
      stroke={stroke}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );

  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      {condition === "clear" || condition === "partly_cloudy" ? (
        <circle
          cx="46"
          cy="18"
          r="7"
          fill="rgba(250,204,21,0.25)"
          stroke="rgba(250,204,21,0.95)"
          strokeWidth="1.8"
        />
      ) : null}

      {condition === "overcast" ? (
        <path
          d="M12 36h24a7 7 0 0 0 0-14 11 11 0 0 0-20.7-3.4A8 8 0 0 0 12 36Z"
          fill="rgba(148,163,184,0.18)"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {baseCloud}

      {condition === "rain" ? (
        <g stroke="rgba(125,211,252,0.95)" strokeWidth="2.3" strokeLinecap="round">
          <line x1="23" y1="46" x2="20" y2="54" />
          <line x1="33" y1="47" x2="30" y2="56" />
          <line x1="43" y1="46" x2="40" y2="54" />
        </g>
      ) : null}

      {condition === "snow" ? (
        <g fill="rgba(224,242,254,0.95)">
          <circle cx="23" cy="52" r="2" />
          <circle cx="33" cy="54" r="2" />
          <circle cx="43" cy="52" r="2" />
        </g>
      ) : null}

      {condition === "storm" ? (
        <path
          d="M33 45l-6 10h6l-4 8 12-13h-6l5-5z"
          fill="rgba(250,204,21,0.95)"
        />
      ) : null}

      {condition === "fog" ? (
        <g stroke={stroke} strokeWidth="2" strokeLinecap="round" opacity="0.9">
          <line x1="19" y1="48" x2="47" y2="48" />
          <line x1="16" y1="54" x2="44" y2="54" />
        </g>
      ) : null}
    </svg>
  );
}
