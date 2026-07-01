"use client";

import { useId, useState, type PointerEvent as ReactPointerEvent } from "react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { useMoonCard } from "../hooks/useAstronomy";
import { useWeatherNow } from "../hooks/useWeather";
import type { WeatherCondition } from "../providers/weather";
import {
  DashboardPanelState,
  DashboardSkeletonBlock,
  DashboardStatusBanner,
} from "./DashboardState";
import { MoonPhaseCircle } from "./MoonPhaseCircle";
import { SunDisc } from "./SunDisc";
import {
  buildTwilightWindowFrames,
  DASHBOARD_BADGE_MUTED_CLASS,
  formatClockRange,
  DASHBOARD_METRIC_LABEL_CLASS,
  DASHBOARD_METRIC_TILE_CLASS,
  DASHBOARD_MUTED_TEXT_CLASS,
  DASHBOARD_PANEL_CLASS,
  DASHBOARD_PANEL_TITLE_CLASS,
  DASHBOARD_SURFACE_CLASS,
} from "./moonDashboardShared";
import nightStars from "../../public/sky/night-starfield.jpg";

const VIEW_W = 160;
const VIEW_H = 36;
const HORIZON_Y = 21;
const AMP = 12;
const MOON_VISUAL_PEAK_Y = 8;
const MOON_VISUAL_TROUGH_Y = 32.5;
const MOON_VISUAL_SAMPLES = 220;
const MOON_BELOW_HORIZON_LINEAR_BLEND = 0.38;
const MOON_HOVER_TOOLTIP_EDGE_PADDING_PCT = 4;
const MOON_HOVER_TOOLTIP_OFFSET_PCT = 2.5;
const MOON_HOVER_TOOLTIP_CENTER_MIN_PCT = 32;
const MOON_HOVER_TOOLTIP_CENTER_MAX_PCT = 68;
const MOON_HOVER_TOOLTIP_HIGH_POINT_THRESHOLD_PCT = 46;
const MOON_PLOT_TOP_Y = 2;
const MOON_PLOT_BOTTOM_Y = VIEW_H - 2;
const MIN_MOON_ABOVE_ALTITUDE = 20;
const MIN_MOON_BELOW_MAGNITUDE = 12;
const MOON_ABOVE_HORIZON_BOOST_EXPONENT = 0.65;
const MOON_BELOW_HORIZON_COMPRESS_EXPONENT = 0.9;
const HORIZON_LINE_STROKE = "rgba(226,232,240,0.72)";
const HORIZON_LINE_GLOW_STROKE = "rgba(125,211,252,0.1)";
const BELOW_HORIZON_GRADIENT_TOP = "#121d30";
const BELOW_HORIZON_GRADIENT_MID = "#08111f";
const BELOW_HORIZON_GRADIENT_BOTTOM = "#020617";
const BELOW_HORIZON_HAZE_TOP = "rgba(186,230,253,0.14)";
const BELOW_HORIZON_HAZE_BOTTOM = "rgba(15,23,42,0)";
const BELOW_HORIZON_LIMB_STROKE = "rgba(148,163,184,0.13)";

type TwilightPhase = "dark" | "astronomical" | "nautical" | "civil" | "day";

type SkyStripe = {
  x: number;
  width: number;
  phase: TwilightPhase;
};

type TwilightBand = {
  startMs: number;
  endMs: number;
  phase: TwilightPhase;
};

type TimedAltitudeSample = {
  time_utc: string;
  altitude_deg: number;
  azimuth_deg: number;
  above_horizon: boolean;
};

type AltitudePlotPoint = {
  ms: number;
  x: number;
  y: number;
  altitudeDeg: number;
  azimuthDeg: number;
  aboveHorizon: boolean;
};

type ValidTimedAltitudeSample = TimedAltitudeSample & {
  ms: number;
};

type MoonHoverTooltipLayout = {
  leftPct: number;
  horizontalAlign: "start" | "center" | "end";
  verticalAlign: "top" | "bottom";
};

const TWILIGHT_BAND_COLOR: Record<TwilightPhase, string> = {
  day: "#8ec9ff",
  civil: "#74b4ff",
  nautical: "#4b86ff",
  astronomical: "#5c6ce8",
  dark: "#6b78d4",
};

const TWILIGHT_LABEL: Record<TwilightPhase, string> = {
  dark: "Night",
  astronomical: "Astronomical",
  nautical: "Nautical",
  civil: "Civil",
  day: "Day",
};

const PHASE_WEATHER_IMAGE_OPACITY: Record<TwilightPhase, number> = {
  day: 0.98,
  civil: 0.68,
  nautical: 0.18,
  astronomical: 0.04,
  dark: 0,
};

const PHASE_NIGHT_IMAGE_OPACITY: Record<TwilightPhase, number> = {
  day: 0,
  civil: 0.18,
  nautical: 0.52,
  astronomical: 0.82,
  dark: 1,
};

const PHASE_TINT_OPACITY: Record<TwilightPhase, number> = {
  day: 0.08,
  civil: 0.1,
  nautical: 0.12,
  astronomical: 0.08,
  dark: 0,
};

const PHASE_NIGHT_SHADE_OPACITY: Record<TwilightPhase, number> = {
  day: 0,
  civil: 0.1,
  nautical: 0.08,
  astronomical: 0.04,
  dark: 0,
};

const PHASE_ATMOSPHERE_OPACITY: Record<TwilightPhase, number> = {
  day: 1,
  civil: 0.52,
  nautical: 0.18,
  astronomical: 0.06,
  dark: 0,
};

const PHASE_SKY_SHADOW_OPACITY: Record<TwilightPhase, number> = {
  day: 0.35,
  civil: 0.24,
  nautical: 0.08,
  astronomical: 0.03,
  dark: 0,
};

const NIGHT_SKY_IMAGE_URL = nightStars.src;

const WEATHER_SKY_IMAGE_URL: Record<WeatherCondition, string> = {
  clear:
    "https://commons.wikimedia.org/wiki/Special:Redirect/file/Clouds_in_blue_sky.jpg",
  partly_cloudy:
    "https://commons.wikimedia.org/wiki/Special:Redirect/file/Above_the_Clouds.jpg",
  overcast:
    "https://commons.wikimedia.org/wiki/Special:Redirect/file/Cloudy_sky_%2826171935906%29.jpg",
  rain: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Storm_clouds.jpg",
  snow: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Snowy_Polish_countryside_February_2015.jpg",
  storm:
    "https://commons.wikimedia.org/wiki/Special:Redirect/file/Storm_clouds.jpg",
  fog: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Cloudy_sky_%2826171935906%29.jpg",
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function formatRoundedDegrees(value: number) {
  return `${Math.round(value)}°`;
}

function formatLegendTime(iso: string | null | undefined, tz: string) {
  if (!iso) return "—";

  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";

  return formatInTimeZone(date, tz, "h:mm a");
}

function toCompassDirection(azDeg: number) {
  const dirs = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  const normalized = ((azDeg % 360) + 360) % 360;
  return dirs[Math.round(normalized / 22.5) % dirs.length];
}

function formatAzimuthWithDirection(azDeg: number) {
  const normalized = Math.round(((azDeg % 360) + 360) % 360);
  return `${toCompassDirection(normalized)} / ${normalized}°`;
}

function resolveWeatherSkyImage(condition: WeatherCondition | undefined) {
  return WEATHER_SKY_IMAGE_URL[condition ?? "clear"];
}

function normalizeTwilightPhase(phase?: string | null): TwilightPhase {
  switch ((phase ?? "").toLowerCase()) {
    case "astronomical":
    case "nautical":
    case "civil":
    case "day":
    case "dark":
      return (phase ?? "").toLowerCase() as TwilightPhase;
    default:
      return "dark";
  }
}

export function buildMoonAltitudeScale(samples: TimedAltitudeSample[]) {
  const positiveAltitudes = samples
    .map((sample) => sample.altitude_deg)
    .filter(
      (altitude): altitude is number =>
        Number.isFinite(altitude) && altitude > 0,
    );

  const negativeMagnitudes = samples
    .map((sample) => sample.altitude_deg)
    .filter(
      (altitude): altitude is number =>
        Number.isFinite(altitude) && altitude < 0,
    )
    .map((altitude) => Math.abs(altitude));

  const maxAboveAltitude =
    positiveAltitudes.length > 0
      ? Math.max(MIN_MOON_ABOVE_ALTITUDE, ...positiveAltitudes)
      : MIN_MOON_ABOVE_ALTITUDE;
  const maxBelowMagnitude =
    negativeMagnitudes.length > 0
      ? Math.max(MIN_MOON_BELOW_MAGNITUDE, ...negativeMagnitudes)
      : MIN_MOON_BELOW_MAGNITUDE;

  return function moonAltitudeToY(altitudeDeg: number) {
    if (!Number.isFinite(altitudeDeg)) {
      return HORIZON_Y;
    }

    if (altitudeDeg >= 0) {
      const normalized = clamp01(altitudeDeg / maxAboveAltitude);
      const boosted = Math.pow(
        normalized,
        MOON_ABOVE_HORIZON_BOOST_EXPONENT,
      );

      return HORIZON_Y - boosted * (HORIZON_Y - MOON_PLOT_TOP_Y);
    }

    const normalized = clamp01(Math.abs(altitudeDeg) / maxBelowMagnitude);
    const compressed = Math.pow(
      normalized,
      MOON_BELOW_HORIZON_COMPRESS_EXPONENT,
    );

    return HORIZON_Y + compressed * (MOON_PLOT_BOTTOM_Y - HORIZON_Y);
  };
}

function yOnCurve(t: number) {
  return HORIZON_Y - AMP * Math.sin(2 * Math.PI * t - Math.PI / 2);
}

function formatPathNumber(value: number, decimals = 4) {
  const rounded = Number(value.toFixed(decimals));
  return Number.isFinite(rounded) ? rounded.toString() : "0";
}

function buildCurvePath(samples = 200) {
  let d = "";
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const x = t * VIEW_W;
    const y = yOnCurve(t);
    d += `${i === 0 ? "M" : "L"} ${formatPathNumber(x)},${formatPathNumber(y)} `;
  }
  return d.trim();
}

function toUtcMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function nextDateIso(dateIso: string): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + 1);

  const nextYear = next.getUTCFullYear();
  const nextMonth = String(next.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(next.getUTCDate()).padStart(2, "0");

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function timeToX(ms: number, dayStartMs: number, dayEndMs: number): number {
  const span = Math.max(1, dayEndMs - dayStartMs);
  return clamp01((ms - dayStartMs) / span) * VIEW_W;
}

export function buildAltitudePlotPoints(input: {
  samples: TimedAltitudeSample[] | null | undefined;
  dayStartMs: number;
  dayEndMs: number;
}): AltitudePlotPoint[] {
  if (!Array.isArray(input.samples)) {
    return [];
  }

  const validSamples = input.samples
    .map((sample) => {
      const ms = toUtcMs(sample.time_utc);
      if (
        ms === null ||
        ms < input.dayStartMs ||
        ms > input.dayEndMs ||
        !Number.isFinite(sample.altitude_deg) ||
        !Number.isFinite(sample.azimuth_deg) ||
        typeof sample.above_horizon !== "boolean"
      ) {
        return null;
      }

      return {
        ms,
        ...sample,
      };
    })
    .filter(
      (sample): sample is ValidTimedAltitudeSample => sample !== null,
    )
    .sort((a, b) => a.ms - b.ms);

  const uniqueSamples: ValidTimedAltitudeSample[] = [];
  for (const sample of validSamples) {
    const previousSample = uniqueSamples.at(-1);
    if (previousSample && previousSample.ms === sample.ms) {
      uniqueSamples[uniqueSamples.length - 1] = sample;
      continue;
    }
    uniqueSamples.push(sample);
  }

  const moonAltitudeToY = buildMoonAltitudeScale(uniqueSamples);

  return uniqueSamples.map((sample) => ({
    ms: sample.ms,
    x: timeToX(sample.ms, input.dayStartMs, input.dayEndMs),
    y: moonAltitudeToY(sample.altitude_deg),
    altitudeDeg: sample.altitude_deg,
    azimuthDeg: sample.azimuth_deg,
    aboveHorizon: sample.above_horizon,
  }));
}

export function findNearestMoonSampleByMs(
  points: AltitudePlotPoint[],
  targetMs: number,
) {
  if (points.length === 0) {
    return null;
  }

  let nearestPoint = points[0];
  let nearestDistance = Math.abs(points[0].ms - targetMs);

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    const distance = Math.abs(point.ms - targetMs);

    if (distance < nearestDistance) {
      nearestPoint = point;
      nearestDistance = distance;
      continue;
    }

    if (point.ms > targetMs && distance > nearestDistance) {
      break;
    }
  }

  return nearestPoint;
}

export function buildMoonHoverTooltipLayout(input: {
  hoverX: number;
  hoverY: number;
}): MoonHoverTooltipLayout {
  const hoverXPct = clamp01(input.hoverX / VIEW_W) * 100;
  const hoverYPct = clamp01(input.hoverY / VIEW_H) * 100;
  const verticalAlign =
    hoverYPct < MOON_HOVER_TOOLTIP_HIGH_POINT_THRESHOLD_PCT
      ? "bottom"
      : "top";

  if (hoverXPct <= MOON_HOVER_TOOLTIP_CENTER_MIN_PCT) {
    return {
      leftPct: Math.max(
        MOON_HOVER_TOOLTIP_EDGE_PADDING_PCT,
        hoverXPct + MOON_HOVER_TOOLTIP_OFFSET_PCT,
      ),
      horizontalAlign: "start",
      verticalAlign,
    };
  }

  if (hoverXPct >= MOON_HOVER_TOOLTIP_CENTER_MAX_PCT) {
    return {
      leftPct: Math.min(
        100 - MOON_HOVER_TOOLTIP_EDGE_PADDING_PCT,
        hoverXPct - MOON_HOVER_TOOLTIP_OFFSET_PCT,
      ),
      horizontalAlign: "end",
      verticalAlign,
    };
  }

  return {
    leftPct: hoverXPct,
    horizontalAlign: "center",
    verticalAlign,
  };
}

function easeInOutSine(progress: number) {
  return -(Math.cos(Math.PI * clamp01(progress)) - 1) / 2;
}

function buildMoonVisualCycleState(input: {
  targetMs: number;
  dayStartMs: number;
  dayEndMs: number;
  riseMs: number;
  setMs: number;
  peakMs: number;
}) {
  const { targetMs, dayStartMs, dayEndMs, riseMs, setMs, peakMs } = input;

  if (targetMs >= riseMs && targetMs <= setMs) {
    const spanMs = Math.max(1, setMs - riseMs);
    const progress = clamp01((targetMs - riseMs) / spanMs);
    return {
      isAboveHorizon: true,
      progress,
      normalizedDistanceToPeak:
        targetMs <= peakMs
          ? clamp01((peakMs - targetMs) / Math.max(1, peakMs - riseMs))
          : clamp01((targetMs - peakMs) / Math.max(1, setMs - peakMs)),
    };
  }

  if (targetMs < riseMs) {
    return {
      isAboveHorizon: false,
      progress: clamp01((targetMs - dayStartMs) / Math.max(1, riseMs - dayStartMs)),
      normalizedDistanceToPeak: 0,
    };
  }

  return {
    isAboveHorizon: false,
    progress: clamp01((targetMs - setMs) / Math.max(1, dayEndMs - setMs)),
    normalizedDistanceToPeak: 0,
  };
}

export function getMoonVisualYForMs(input: {
  targetMs: number;
  dayStartMs: number;
  dayEndMs: number;
  riseMs: number | null;
  setMs: number | null;
  peakMs: number | null;
  isUp: boolean | null;
}) {
  const riseMs =
    input.riseMs === null
      ? null
      : Math.max(input.dayStartMs, Math.min(input.dayEndMs, input.riseMs));
  const setMs =
    input.setMs === null
      ? null
      : Math.max(input.dayStartMs, Math.min(input.dayEndMs, input.setMs));

  if (riseMs !== null && setMs !== null && setMs > riseMs) {
    const fallbackPeakMs = riseMs + (setMs - riseMs) / 2;
    const peakMsRaw = input.peakMs ?? fallbackPeakMs;
    const peakMs = Math.max(riseMs, Math.min(setMs, peakMsRaw));
    const state = buildMoonVisualCycleState({
      targetMs: input.targetMs,
      dayStartMs: input.dayStartMs,
      dayEndMs: input.dayEndMs,
      riseMs,
      setMs,
      peakMs,
    });

    if (state.isAboveHorizon) {
      const peakHeight = HORIZON_Y - MOON_VISUAL_PEAK_Y;
      const arcShape = Math.sin(state.progress * Math.PI);
      const peakBias = 1 - Math.pow(state.normalizedDistanceToPeak, 1.35);
      const combinedArc = clamp01(arcShape * 0.72 + peakBias * 0.28);
      return HORIZON_Y - combinedArc * peakHeight;
    }

    const troughDepth = MOON_VISUAL_TROUGH_Y - HORIZON_Y;
    const easedProgress = easeInOutSine(state.progress);
    const blendedProgress = lerp(
      easedProgress,
      state.progress,
      MOON_BELOW_HORIZON_LINEAR_BLEND,
    );
    const belowShape =
      input.targetMs < riseMs
        ? Math.sin((1 - blendedProgress) * (Math.PI / 2))
        : Math.sin(blendedProgress * (Math.PI / 2));
    return HORIZON_Y + belowShape * troughDepth;
  }

  return buildOrbitCurveY({
    nowMs: input.targetMs,
    dayStartMs: input.dayStartMs,
    dayEndMs: input.dayEndMs,
    riseMs: input.riseMs,
    setMs: input.setMs,
    isUp: input.isUp,
  });
}

export function buildMoonVisualOrbitPath(input: {
  dayStartMs: number;
  dayEndMs: number;
  riseMs: number | null;
  setMs: number | null;
  peakMs: number | null;
  isUp: boolean | null;
  samples?: number;
}) {
  const samples = input.samples ?? MOON_VISUAL_SAMPLES;
  let d = "";

  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const ms = lerp(input.dayStartMs, input.dayEndMs, t);
    const x = timeToX(ms, input.dayStartMs, input.dayEndMs);
    const y = getMoonVisualYForMs({
      targetMs: ms,
      dayStartMs: input.dayStartMs,
      dayEndMs: input.dayEndMs,
      riseMs: input.riseMs,
      setMs: input.setMs,
      peakMs: input.peakMs,
      isUp: input.isUp,
    });
    d += `${i === 0 ? "M" : "L"} ${formatPathNumber(x)},${formatPathNumber(y)} `;
  }

  return d.trim();
}

export function buildMoonAltitudeSamplePath(points: AltitudePlotPoint[]) {
  if (points.length < 2) {
    return "";
  }

  let d = "";

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    d += `${index === 0 ? "M" : "L"} ${formatPathNumber(point.x)},${formatPathNumber(point.y)} `;
  }

  return d.trim();
}

export function interpolatePlotPointAtMs(
  points: AltitudePlotPoint[],
  targetMs: number,
) {
  if (points.length === 0) {
    return null;
  }

  if (targetMs <= points[0].ms) {
    return { x: points[0].x, y: points[0].y };
  }

  const lastPoint = points.at(-1);
  if (!lastPoint) {
    return null;
  }
  if (targetMs >= lastPoint.ms) {
    return { x: lastPoint.x, y: lastPoint.y };
  }

  for (let index = 1; index < points.length; index += 1) {
    const previousPoint = points[index - 1];
    const nextPoint = points[index];
    if (targetMs > nextPoint.ms) {
      continue;
    }

    const spanMs = Math.max(1, nextPoint.ms - previousPoint.ms);
    const progress = clamp01((targetMs - previousPoint.ms) / spanMs);

    return {
      x: lerp(previousPoint.x, nextPoint.x, progress),
      y: lerp(previousPoint.y, nextPoint.y, progress),
    };
  }

  return { x: lastPoint.x, y: lastPoint.y };
}

function buildTwilightBands(input: {
  dayStartMs: number;
  dayEndMs: number;
  fallbackPhase: TwilightPhase;
  segments: Array<{
    phase: string | null;
    start: string | null;
    end: string | null;
  }>;
}): TwilightBand[] {
  const bands = input.segments
    .map((segment) => ({
      startMs: toUtcMs(segment.start),
      endMs: toUtcMs(segment.end),
      phase: normalizeTwilightPhase(segment.phase),
    }))
    .filter(
      (segment): segment is TwilightBand =>
        segment.startMs !== null &&
        segment.endMs !== null &&
        segment.endMs > segment.startMs,
    )
    .map((segment) => ({
      startMs: Math.max(
        input.dayStartMs,
        Math.min(input.dayEndMs, segment.startMs),
      ),
      endMs: Math.max(
        input.dayStartMs,
        Math.min(input.dayEndMs, segment.endMs),
      ),
      phase: segment.phase,
    }))
    .filter((segment) => segment.endMs > segment.startMs)
    .sort((a, b) => a.startMs - b.startMs);

  if (bands.length > 0) {
    return bands;
  }

  return [
    {
      startMs: input.dayStartMs,
      endMs: input.dayEndMs,
      phase: input.fallbackPhase,
    },
  ];
}

function buildSkyStripes(
  bands: TwilightBand[],
  dayStartMs: number,
  dayEndMs: number,
): SkyStripe[] {
  return bands.map((band) => {
    const x = timeToX(band.startMs, dayStartMs, dayEndMs);
    const endX = timeToX(band.endMs, dayStartMs, dayEndMs);

    return {
      x,
      width: Math.max(0.8, endX - x),
      phase: band.phase,
    };
  });
}

export function buildCyclePosition(input: {
  nowMs: number;
  dayStartMs: number;
  dayEndMs: number;
  riseMs: number | null;
  setMs: number | null;
  isUp: boolean | null;
}): number {
  const daySpan = Math.max(1, input.dayEndMs - input.dayStartMs);
  const nowClamped = Math.max(
    input.dayStartMs,
    Math.min(input.dayEndMs, input.nowMs),
  );
  const fallback = clamp01((nowClamped - input.dayStartMs) / daySpan);

  const riseMs =
    input.riseMs === null
      ? null
      : Math.max(input.dayStartMs, Math.min(input.dayEndMs, input.riseMs));
  const setMs =
    input.setMs === null
      ? null
      : Math.max(input.dayStartMs, Math.min(input.dayEndMs, input.setMs));

  if (riseMs !== null && setMs !== null && setMs > riseMs) {
    if (nowClamped <= riseMs) {
      return (
        clamp01(
          (nowClamped - input.dayStartMs) /
            Math.max(1, riseMs - input.dayStartMs),
        ) * 0.25
      );
    }

    if (nowClamped <= setMs) {
      return 0.25 + ((nowClamped - riseMs) / Math.max(1, setMs - riseMs)) * 0.5;
    }

    return (
      0.75 + ((nowClamped - setMs) / Math.max(1, input.dayEndMs - setMs)) * 0.25
    );
  }

  if (riseMs !== null && setMs !== null && riseMs > setMs) {
    if (nowClamped <= setMs) {
      return (
        0.5 +
        ((nowClamped - input.dayStartMs) /
          Math.max(1, setMs - input.dayStartMs)) *
          0.25
      );
    }

    if (nowClamped < riseMs) {
      return 0.75 + ((nowClamped - setMs) / Math.max(1, riseMs - setMs)) * 0.5;
    }

    return (
      0.25 +
      ((nowClamped - riseMs) / Math.max(1, input.dayEndMs - riseMs)) * 0.25
    );
  }

  if (input.isUp === true) {
    return 0.5;
  }

  if (input.isUp === false) {
    return fallback < 0.5 ? 0.12 : 0.88;
  }

  return fallback;
}

export function buildOrbitCurveY(input: {
  nowMs: number;
  dayStartMs: number;
  dayEndMs: number;
  riseMs: number | null;
  setMs: number | null;
  isUp: boolean | null;
}) {
  return yOnCurve(buildCyclePosition(input));
}

function buildTimedOrbitPath(input: {
  dayStartMs: number;
  dayEndMs: number;
  riseMs: number | null;
  setMs: number | null;
  isUp: boolean | null;
  samples?: number;
}) {
  const samples = input.samples ?? 220;
  let d = "";

  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const ms = lerp(input.dayStartMs, input.dayEndMs, t);
    const x = timeToX(ms, input.dayStartMs, input.dayEndMs);
    const y = buildOrbitCurveY({
      nowMs: ms,
      dayStartMs: input.dayStartMs,
      dayEndMs: input.dayEndMs,
      riseMs: input.riseMs,
      setMs: input.setMs,
      isUp: input.isUp,
    });
    d += `${i === 0 ? "M" : "L"} ${formatPathNumber(x)},${formatPathNumber(y)} `;
  }

  return d.trim();
}

const CURVE_PATH = buildCurvePath(220);

export default function MoonAltitudeGraph({
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
  const idPrefix = useId().replace(/:/g, "-");
  const [hoveredMoonSampleMs, setHoveredMoonSampleMs] = useState<number | null>(
    null,
  );

  function handleChartPointerLeave() {
    setHoveredMoonSampleMs(null);
  }

  if (summaryQ.error && !summaryQ.data) {
    return (
      <DashboardPanelState
        title="Timeline unavailable"
        body="The astronomy timeline could not be loaded right now."
        tone="danger"
        minHeightClass="min-h-[18rem]"
      />
    );
  }

  if (!summaryQ.data) {
    return (
      <div className={`${DASHBOARD_PANEL_CLASS} min-h-[18rem]`}>
        <div className="flex items-center justify-between gap-2">
          <DashboardSkeletonBlock className="h-4 w-36" />
          <DashboardSkeletonBlock className="h-5 w-24 rounded-full" />
        </div>

        <DashboardSkeletonBlock className="h-[10.75rem] rounded-[1rem]" />

        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 7 }).map((_, index) => (
            <DashboardSkeletonBlock
              key={`moon-graph-pill-skeleton-${index}`}
              className="h-6 w-24 rounded-full"
            />
          ))}
        </div>

        <DashboardStatusBanner>
          Loading the astronomy timeline. This can take a moment.
        </DashboardStatusBanner>
      </div>
    );
  }

  const summary = summaryQ.data;
  const now = new Date(summary.meta.timestamp_iso);
  const nowMs = now.getTime();
  const hasCanonicalSummaryIssues = summary.errors.length > 0;
  const localDate = summary.meta.requested_datetime.date;
  const dayStartMs = fromZonedTime(`${localDate}T00:00:00`, tz).getTime();
  const dayEndMs = fromZonedTime(
    `${nextDateIso(localDate)}T00:00:00`,
    tz,
  ).getTime();
  const moonPathPoints = buildAltitudePlotPoints({
    samples: summary.moon.path?.samples,
    dayStartMs,
    dayEndMs,
  });
  const hoveredMoonPoint =
    hoveredMoonSampleMs === null
      ? null
      : findNearestMoonSampleByMs(moonPathPoints, hoveredMoonSampleMs);
  const hasRealMoonPath = moonPathPoints.length >= 2;
  const hasPartialTimeline =
    summary.twilight.segments.length === 0 ||
    summary.sun.sunrise === null ||
    summary.sun.sunset === null ||
    !hasRealMoonPath;
  const timelineStatus = summaryQ.error
    ? {
        tone: "warning" as const,
        message: "Timeline refresh failed. Showing the last update.",
      }
    : hasCanonicalSummaryIssues
      ? {
          tone: "warning" as const,
          message:
            "Astronomy data is degraded. Some timeline moments may be limited.",
        }
      : hasPartialTimeline
        ? {
            tone: "neutral" as const,
            message: "Timeline is using partial astronomy data.",
          }
        : null;

  const twilightPhase = normalizeTwilightPhase(summary.twilight.current_phase);
  const twilightLabel = TWILIGHT_LABEL[twilightPhase];
  const twilightBands = buildTwilightBands({
    dayStartMs,
    dayEndMs,
    fallbackPhase: twilightPhase,
    // The route keeps raw twilight segment instants stable so the UI can build
    // visual timelines without learning Python-internal field names.
    segments: summary.twilight.segments,
  });

  const sunriseMs = toUtcMs(summary.sun.sunrise);
  const sunsetMs = toUtcMs(summary.sun.sunset);
  const moonriseMs = toUtcMs(summary.moon.moonrise);
  const moonsetMs = toUtcMs(summary.moon.moonset);
  const highMoonMs = toUtcMs(summary.moon.high_moon);
  const nowX = timeToX(nowMs, dayStartMs, dayEndMs);
  const moonDotX = nowX;
  const sunDotX = nowX;
  const fallbackMoonDotY = getMoonVisualYForMs({
    targetMs: nowMs,
    dayStartMs,
    dayEndMs,
    riseMs: moonriseMs,
    setMs: moonsetMs,
    peakMs: highMoonMs,
    isUp: summary.moon.is_up,
  });
  const moonDotY =
    hasRealMoonPath
      ? interpolatePlotPointAtMs(moonPathPoints, nowMs)?.y ?? fallbackMoonDotY
      : fallbackMoonDotY;
  const sunDotY = buildOrbitCurveY({
    dayStartMs,
    dayEndMs,
    nowMs,
    riseMs: sunriseMs,
    setMs: sunsetMs,
    isUp: summary.sun.is_up,
  });
  const sunCurvePath =
    sunriseMs !== null || sunsetMs !== null
      ? buildTimedOrbitPath({
          dayStartMs,
          dayEndMs,
          riseMs: sunriseMs,
          setMs: sunsetMs,
          isUp: summary.sun.is_up,
        })
      : CURVE_PATH;
  const moonCurvePath =
    moonPathPoints.length >= 2
      ? buildMoonAltitudeSamplePath(moonPathPoints)
      : buildMoonVisualOrbitPath({
          dayStartMs,
          dayEndMs,
          riseMs: moonriseMs,
          setMs: moonsetMs,
          peakMs: highMoonMs,
          isUp: summary.moon.is_up,
        });
  const hoveredMoonVisualX = hoveredMoonPoint?.x ?? null;
  const hoveredMoonVisualY =
    hoveredMoonPoint === null
      ? null
      : hasRealMoonPath
        ? hoveredMoonPoint.y
        : getMoonVisualYForMs({
            targetMs: hoveredMoonPoint.ms,
            dayStartMs,
            dayEndMs,
            riseMs: moonriseMs,
            setMs: moonsetMs,
            peakMs: highMoonMs,
            isUp: summary.moon.is_up,
          });
  const hoveredMoonTooltipLayout =
    hoveredMoonVisualX === null || hoveredMoonVisualY === null
      ? null
      : buildMoonHoverTooltipLayout({
          hoverX: hoveredMoonVisualX,
          hoverY: hoveredMoonVisualY,
        });

  function handleChartPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (moonPathPoints.length === 0) {
      setHoveredMoonSampleMs(null);
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0) {
      setHoveredMoonSampleMs(null);
      return;
    }

    const svgX = clamp01((event.clientX - bounds.left) / bounds.width) * VIEW_W;
    const targetMs = lerp(dayStartMs, dayEndMs, svgX / VIEW_W);
    const nearestSample = findNearestMoonSampleByMs(moonPathPoints, targetMs);

    setHoveredMoonSampleMs(nearestSample?.ms ?? null);
  }

  const skyStripes = buildSkyStripes(twilightBands, dayStartMs, dayEndMs);
  const weatherCondition = weatherQ.data?.condition;
  const weatherCloudCover = clamp01((weatherQ.data?.cloudCoverPct ?? 0) / 100);
  const weatherSkyImageUrl = resolveWeatherSkyImage(weatherCondition);
  const nightSkyStrength = lerp(0.96, 0.64, weatherCloudCover);
  const weatherSkyStrength = lerp(0.78, 0.96, weatherCloudCover);
  const skyShadowOpacity = lerp(0.05, 0.16, weatherCloudCover);
  const weatherAtmosphereOpacity = lerp(0.03, 0.12, weatherCloudCover);
  const objectLegendItems = [
    {
      key: "moon-now",
      label: "Moon now",
      markerClass: "bg-slate-100/92",
      value: null,
      marker: "dot" as const,
    },
    {
      key: "sun-now",
      label: "Sun now",
      markerClass: "bg-amber-300/92",
      value: null,
      marker: "dot" as const,
    },
    {
      key: "horizon",
      label: "Horizon",
      markerClass: "bg-slate-300/78",
      value: null,
      marker: "line" as const,
    },
    {
      key: "sunrise",
      label: "Sunrise",
      markerClass: "bg-sky-300/88",
      value: formatLegendTime(summary.sun.sunrise, tz),
      marker: "dot" as const,
    },
    {
      key: "sunset",
      label: "Sunset",
      markerClass: "bg-orange-300/88",
      value: formatLegendTime(summary.sun.sunset, tz),
      marker: "dot" as const,
    },
  ];
  const twilightWindowFrames = buildTwilightWindowFrames(
    summary.twilight,
    summary.sun,
  );
  const twilightWindowItems = [
    {
      key: "civil",
      label: "Civil twilight",
      helper: "Bright twilight",
      frames: twilightWindowFrames.civil,
    },
    {
      key: "nautical",
      label: "Nautical twilight",
      helper: "Darker sky",
      frames: twilightWindowFrames.nautical,
    },
    {
      key: "astronomical",
      label: "Astronomical twilight",
      helper: "Best dark-sky window",
      frames: twilightWindowFrames.astronomical,
    },
  ] as const;

  const lastUpdatedLabel = summaryQ.dataUpdatedAt
    ? formatInTimeZone(new Date(summaryQ.dataUpdatedAt), tz, "h:mm a")
    : "—";

  const plotClipId = `${idPrefix}-plotClip`;
  const sunAuraBlurId = `${idPrefix}-sunAuraBlur`;
  const moonAuraBlurId = `${idPrefix}-moonAuraBlur`;
  const belowHorizonBandGradientId = `${idPrefix}-belowHorizonBandGradient`;
  const belowHorizonHazeGradientId = `${idPrefix}-belowHorizonHazeGradient`;
  const belowHorizonLimbGradientId = `${idPrefix}-belowHorizonLimbGradient`;
  const belowHorizonClipId = `${idPrefix}-belowHorizonClip`;

  return (
    <div className={`${DASHBOARD_PANEL_CLASS} min-h-[18rem]`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className={`${DASHBOARD_PANEL_TITLE_CLASS} mt-0`}>
            Moon/Sun altitude
          </h2>
          <span className={`${DASHBOARD_BADGE_MUTED_CLASS} gap-1.5 px-2`}>
            <span
              className="h-1.5 w-1.5 rounded-full ring-1 ring-white/20"
              style={{ backgroundColor: TWILIGHT_BAND_COLOR[twilightPhase] }}
            />
            Twilight {twilightLabel}
          </span>
        </div>
        <div className={`whitespace-nowrap ${DASHBOARD_MUTED_TEXT_CLASS}`}>
          Updated {lastUpdatedLabel}
          {summaryQ.isFetching ? " · updating" : ""}
        </div>
      </header>

      {timelineStatus ? (
        <DashboardStatusBanner tone={timelineStatus.tone}>
          {timelineStatus.message}
        </DashboardStatusBanner>
      ) : null}

      <div className="space-y-1.5">
        <div className={`${DASHBOARD_SURFACE_CLASS} overflow-hidden bg-black/50 px-0 py-0`}>
          <div className="relative aspect-[5/1.24] w-full">
            <svg
              data-testid="moon-graph-svg"
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              preserveAspectRatio="none"
              className="block h-full w-full"
              style={{ isolation: "isolate" }}
              onPointerDown={handleChartPointerMove}
              onPointerMove={handleChartPointerMove}
              onPointerLeave={handleChartPointerLeave}
              onPointerCancel={handleChartPointerLeave}
            >
              <defs>
                <clipPath id={plotClipId}>
                  <rect
                    x="0"
                    y="0"
                    width={VIEW_W}
                    height={VIEW_H}
                    rx="2.5"
                    ry="2.5"
                  />
                </clipPath>

                <clipPath id={belowHorizonClipId}>
                  <rect
                    x="0"
                    y={HORIZON_Y}
                    width={VIEW_W}
                    height={VIEW_H - HORIZON_Y}
                  />
                </clipPath>

                <filter
                  id={sunAuraBlurId}
                  x="-50%"
                  y="-50%"
                  width="200%"
                  height="200%"
                >
                  <feGaussianBlur stdDeviation="10" />
                </filter>

                <filter
                  id={moonAuraBlurId}
                  x="-50%"
                  y="-50%"
                  width="200%"
                  height="200%"
                >
                  <feGaussianBlur stdDeviation="9" />
                </filter>

                <linearGradient
                  id={belowHorizonBandGradientId}
                  x1="0"
                  y1={HORIZON_Y}
                  x2="0"
                  y2={VIEW_H}
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor={BELOW_HORIZON_GRADIENT_TOP} />
                  <stop offset="58%" stopColor={BELOW_HORIZON_GRADIENT_MID} />
                  <stop
                    offset="100%"
                    stopColor={BELOW_HORIZON_GRADIENT_BOTTOM}
                  />
                </linearGradient>

                <linearGradient
                  id={belowHorizonHazeGradientId}
                  x1="0"
                  y1={HORIZON_Y}
                  x2="0"
                  y2={HORIZON_Y + 6}
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor={BELOW_HORIZON_HAZE_TOP} />
                  <stop offset="44%" stopColor="rgba(56,189,248,0.035)" />
                  <stop offset="100%" stopColor={BELOW_HORIZON_HAZE_BOTTOM} />
                </linearGradient>

                <radialGradient
                  id={belowHorizonLimbGradientId}
                  cx={VIEW_W / 2}
                  cy={VIEW_H + 8}
                  r="84"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor="rgba(15,23,42,0.56)" />
                  <stop offset="52%" stopColor="rgba(2,6,23,0.26)" />
                  <stop offset="100%" stopColor="rgba(2,6,23,0)" />
                </radialGradient>

                {skyStripes.map((stripe, idx) => (
                  <clipPath
                    key={`${idPrefix}-sky-stripe-${idx}`}
                    id={`${idPrefix}-sky-stripe-${idx}`}
                  >
                    <rect
                      x={stripe.x}
                      y="0"
                      width={stripe.width}
                      height={HORIZON_Y}
                    />
                  </clipPath>
                ))}
              </defs>

              <g clipPath={`url(#${plotClipId})`}>
                <g id="bg">
                  <rect
                    x="0"
                    y="0"
                    width={VIEW_W}
                    height={HORIZON_Y}
                    fill="#020617"
                  />
                  {skyStripes.map((stripe, idx) => {
                    const weatherOpacity =
                      PHASE_WEATHER_IMAGE_OPACITY[stripe.phase] *
                      weatherSkyStrength;
                    const nightOpacity =
                      PHASE_NIGHT_IMAGE_OPACITY[stripe.phase] * nightSkyStrength;

                    return (
                      <g
                        key={`sky-col-${idx}`}
                        clipPath={`url(#${idPrefix}-sky-stripe-${idx})`}
                      >
                        {weatherOpacity > 0 ? (
                          <image
                            href={weatherSkyImageUrl}
                            x="0"
                            y="0"
                            width={VIEW_W}
                            height={HORIZON_Y}
                            preserveAspectRatio="xMidYMid slice"
                            opacity={weatherOpacity}
                          />
                        ) : null}
                        {nightOpacity > 0 ? (
                          <image
                            href={NIGHT_SKY_IMAGE_URL}
                            x={stripe.x}
                            y="0"
                            width={stripe.width}
                            height={HORIZON_Y}
                            preserveAspectRatio="xMidYMid slice"
                            opacity={nightOpacity}
                          />
                        ) : null}
                        {PHASE_NIGHT_SHADE_OPACITY[stripe.phase] > 0 ? (
                          <rect
                            x={stripe.x}
                            y="0"
                            width={stripe.width}
                            height={HORIZON_Y}
                            fill="rgba(0,0,0,1)"
                            opacity={PHASE_NIGHT_SHADE_OPACITY[stripe.phase]}
                          />
                        ) : null}
                        <rect
                          x={stripe.x}
                          y="0"
                          width={stripe.width}
                          height={HORIZON_Y}
                          fill={TWILIGHT_BAND_COLOR[stripe.phase]}
                          opacity={PHASE_TINT_OPACITY[stripe.phase]}
                        />
                        {PHASE_ATMOSPHERE_OPACITY[stripe.phase] > 0 ? (
                          <rect
                            x={stripe.x}
                            y="0"
                            width={stripe.width}
                            height={HORIZON_Y}
                            fill={`rgba(226,232,240,${weatherAtmosphereOpacity})`}
                            opacity={PHASE_ATMOSPHERE_OPACITY[stripe.phase]}
                          />
                        ) : null}
                        {PHASE_SKY_SHADOW_OPACITY[stripe.phase] > 0 ? (
                          <rect
                            x={stripe.x}
                            y="0"
                            width={stripe.width}
                            height={HORIZON_Y}
                            fill={`rgba(2,6,23,${skyShadowOpacity})`}
                            opacity={PHASE_SKY_SHADOW_OPACITY[stripe.phase]}
                          />
                        ) : null}
                      </g>
                    );
                  })}
                  <g
                    id="below-horizon"
                    data-testid="below-horizon-band"
                    aria-hidden="true"
                    clipPath={`url(#${belowHorizonClipId})`}
                    pointerEvents="none"
                  >
                    <rect
                      x="0"
                      y={HORIZON_Y}
                      width={VIEW_W}
                      height={VIEW_H - HORIZON_Y}
                      fill={`url(#${belowHorizonBandGradientId})`}
                    />
                    <rect
                      data-testid="below-horizon-haze"
                      x="0"
                      y={HORIZON_Y}
                      width={VIEW_W}
                      height="6"
                      fill={`url(#${belowHorizonHazeGradientId})`}
                    />
                    <ellipse
                      data-testid="below-horizon-depth-shadow"
                      cx={VIEW_W / 2}
                      cy={VIEW_H + 8}
                      rx="112"
                      ry="23"
                      fill={`url(#${belowHorizonLimbGradientId})`}
                    />
                    <path
                      data-testid="below-horizon-limb-shadow"
                      d={`M6 ${VIEW_H - 3.5}C38 ${VIEW_H - 8.2} 122 ${
                        VIEW_H - 8.2
                      } 154 ${VIEW_H - 3.5}`}
                      fill="none"
                      stroke={BELOW_HORIZON_LIMB_STROKE}
                      strokeWidth="0.46"
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                </g>

                <g id="lines">
                  <line
                    data-testid="horizon-glow-line"
                    x1="0"
                    y1={HORIZON_Y}
                    x2={VIEW_W}
                    y2={HORIZON_Y}
                    stroke={HORIZON_LINE_GLOW_STROKE}
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d={sunCurvePath}
                    stroke="rgba(250,204,21,0.84)"
                    strokeWidth="1.15"
                    vectorEffect="non-scaling-stroke"
                    fill="none"
                  />
                  <path
                    d={moonCurvePath}
                    stroke="rgba(226,232,240,0.76)"
                    strokeWidth="1.05"
                    vectorEffect="non-scaling-stroke"
                    fill="none"
                  />
                  <line
                    data-testid="horizon-line"
                    x1="0"
                    y1={HORIZON_Y}
                    x2={VIEW_W}
                    y2={HORIZON_Y}
                    stroke={HORIZON_LINE_STROKE}
                    strokeWidth="0.58"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>

                <g filter={`url(#${sunAuraBlurId})`}>
                  <circle
                    cx={sunDotX}
                    cy={sunDotY}
                    r="12"
                    fill="rgba(255,220,120,0.32)"
                  />
                </g>

                <g filter={`url(#${moonAuraBlurId})`}>
                  <circle
                    cx={moonDotX}
                    cy={moonDotY}
                    r="12"
                    fill="rgba(180,210,255,0.24)"
                  />
                </g>

                <g id="markers">
                  <MoonPhaseCircle
                    mode="g"
                    cx={moonDotX}
                    cy={moonDotY}
                    r={2.1}
                    size={15}
                    illuminationFrac={
                      summary.moon.illumination_fraction ?? undefined
                    }
                    phaseAngleDeg={summary.moon.phase_angle_deg ?? undefined}
                    variant="photo"
                  />
                  <SunDisc mode="g" cx={sunDotX} cy={sunDotY} r={1.8} size={15} />
                  {hoveredMoonPoint !== null &&
                  hoveredMoonVisualX !== null &&
                  hoveredMoonVisualY !== null ? (
                    <g id="moon-hover-marker" pointerEvents="none">
                      <line
                        data-testid="moon-hover-guide"
                        x1={hoveredMoonVisualX}
                        y1="0"
                        x2={hoveredMoonVisualX}
                        y2={VIEW_H}
                        stroke="rgba(226,232,240,0.22)"
                        strokeWidth="0.45"
                        strokeDasharray="1.2 1.7"
                        vectorEffect="non-scaling-stroke"
                      />
                      <circle
                        cx={hoveredMoonVisualX}
                        cy={hoveredMoonVisualY}
                        r="2.1"
                        fill="rgba(191,219,254,0.12)"
                        stroke="rgba(226,232,240,0.55)"
                        strokeWidth="0.45"
                        vectorEffect="non-scaling-stroke"
                      />
                      <circle
                        data-testid="moon-hover-marker"
                        cx={hoveredMoonVisualX}
                        cy={hoveredMoonVisualY}
                        r="0.95"
                        fill="rgba(248,250,252,0.96)"
                      />
                    </g>
                  ) : null}
                </g>
              </g>
            </svg>
            {hoveredMoonPoint !== null && hoveredMoonTooltipLayout !== null ? (
              <div
                data-testid="moon-hover-tooltip"
                className={`pointer-events-none absolute z-10 w-[10.5rem] rounded-lg border border-white/12 bg-slate-950/88 px-2.5 py-2 text-[10px] leading-[1.25] text-slate-100 shadow-lg shadow-black/35 ring-1 ring-black/20 backdrop-blur-md transition-opacity duration-150 ${
                  hoveredMoonTooltipLayout.verticalAlign === "top"
                    ? "top-2"
                    : "bottom-2"
                } ${
                  hoveredMoonTooltipLayout.horizontalAlign === "start"
                    ? "translate-x-0"
                    : hoveredMoonTooltipLayout.horizontalAlign === "end"
                      ? "-translate-x-full"
                      : "-translate-x-1/2"
                }`}
                style={{
                  left: `${hoveredMoonTooltipLayout.leftPct}%`,
                  maxWidth: "calc(100% - 0.75rem)",
                }}
              >
                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                  <span className="text-slate-400">Time</span>
                  <span>{formatInTimeZone(new Date(hoveredMoonPoint.ms), tz, "h:mm a")}</span>
                  <span className="text-slate-400">Moon altitude</span>
                  <span>{formatRoundedDegrees(hoveredMoonPoint.altitudeDeg)}</span>
                  <span className="text-slate-400">Direction</span>
                  <span>{formatAzimuthWithDirection(hoveredMoonPoint.azimuthDeg)}</span>
                  <span className="text-slate-400">Status</span>
                  <span>
                    {hoveredMoonPoint.aboveHorizon
                      ? "Above horizon"
                      : "Below horizon"}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {objectLegendItems.map((item) => (
            <div
              key={item.key}
              className={`${DASHBOARD_METRIC_TILE_CLASS} flex items-center gap-2 px-2.5 py-1.5`}
            >
              {item.marker === "line" ? (
                <span className="block h-px w-3 rounded-full bg-slate-300/78" />
              ) : (
                <span
                  className={`h-2 w-2 rounded-full ring-1 ring-white/18 ${item.markerClass}`}
                />
              )}
              <span className="text-[11px] font-medium text-slate-200/80">
                {item.label}
              </span>
              {item.value ? (
                <span className="text-[12px] font-semibold tabular-nums text-slate-50">
                  {item.value}
                </span>
              ) : null}
            </div>
          ))}
        </div>

        <section className={`${DASHBOARD_SURFACE_CLASS} bg-white/[0.02] px-2.5 py-2`}>
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className={DASHBOARD_METRIC_LABEL_CLASS}>Twilight windows</div>
            <div className="text-[10px] text-slate-300/52">
              Sunrise and sunset windows
            </div>
          </div>
          <div className="mt-1.5 grid gap-1.5 sm:grid-cols-3">
            {twilightWindowItems.map((item) => {
              const isActive = twilightPhase === item.key;

              return (
                <div
                  key={item.key}
                  className={`${DASHBOARD_METRIC_TILE_CLASS} min-w-0 px-2.5 py-2 ${
                    isActive
                      ? "border border-white/12 bg-white/[0.045] ring-sky-300/14"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full ring-1 ring-white/20"
                      style={{ backgroundColor: TWILIGHT_BAND_COLOR[item.key] }}
                    />
                    <span className="text-[11px] font-medium text-slate-100/90">
                      {item.label}
                    </span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    {item.frames.map((frame) => (
                      <div
                        key={frame.key}
                        className="min-w-0 rounded-[0.8rem] bg-black/10 px-2 py-1.5 ring-1 ring-inset ring-white/6"
                      >
                        <div className="text-[9px] uppercase tracking-[0.18em] text-slate-300/56">
                          {frame.label}
                        </div>
                        <div className="mt-0.5 text-[11px] font-semibold leading-tight tabular-nums text-slate-50">
                          {formatClockRange(frame.startIso, frame.endIso, tz)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-1.5 text-[10px] text-slate-300/62">
                    {item.helper}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
