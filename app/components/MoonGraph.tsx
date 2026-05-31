"use client";

import { useId } from "react";
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
  DASHBOARD_BADGE_MUTED_CLASS,
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
const MOON_PLOT_TOP_Y = 2;
const MOON_PLOT_BOTTOM_Y = VIEW_H - 2;
const MIN_MOON_ABOVE_ALTITUDE = 20;
const MIN_MOON_BELOW_MAGNITUDE = 12;
const MOON_ABOVE_HORIZON_BOOST_EXPONENT = 0.65;
const MOON_BELOW_HORIZON_COMPRESS_EXPONENT = 0.9;

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
  // Keep the real Moon samples parsed and ready for future hover lookup, but
  // do not let their altitude values control the rendered curve geometry.
  const moonPathPoints = buildAltitudePlotPoints({
    samples: summary.moon.path?.samples,
    dayStartMs,
    dayEndMs,
  });
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
  const moonDotY = getMoonVisualYForMs({
    targetMs: nowMs,
    dayStartMs,
    dayEndMs,
    riseMs: moonriseMs,
    setMs: moonsetMs,
    peakMs: highMoonMs,
    isUp: summary.moon.is_up,
  });
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
  const moonCurvePath = buildMoonVisualOrbitPath({
    dayStartMs,
    dayEndMs,
    riseMs: moonriseMs,
    setMs: moonsetMs,
    peakMs: highMoonMs,
    isUp: summary.moon.is_up,
  });

  const skyStripes = buildSkyStripes(twilightBands, dayStartMs, dayEndMs);
  const weatherCondition = weatherQ.data?.condition;
  const weatherCloudCover = clamp01((weatherQ.data?.cloudCoverPct ?? 0) / 100);
  const weatherSkyImageUrl = resolveWeatherSkyImage(weatherCondition);
  const nightSkyStrength = lerp(0.96, 0.64, weatherCloudCover);
  const weatherSkyStrength = lerp(0.78, 0.96, weatherCloudCover);
  const skyShadowOpacity = lerp(0.05, 0.16, weatherCloudCover);
  const weatherAtmosphereOpacity = lerp(0.03, 0.12, weatherCloudCover);

  const lastUpdatedLabel = summaryQ.dataUpdatedAt
    ? formatInTimeZone(new Date(summaryQ.dataUpdatedAt), tz, "h:mm a")
    : "—";

  const plotClipId = `${idPrefix}-plotClip`;
  const sunAuraBlurId = `${idPrefix}-sunAuraBlur`;
  const moonAuraBlurId = `${idPrefix}-moonAuraBlur`;

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

      <div className={`${DASHBOARD_SURFACE_CLASS} overflow-hidden bg-black/50 px-0 py-0`}>
        <div className="aspect-[5/1.24] w-full">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="none"
            className="block h-full w-full"
            style={{ isolation: "isolate" }}
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
                <rect
                  x="0"
                  y={HORIZON_Y}
                  width={VIEW_W}
                  height={VIEW_H - HORIZON_Y}
                  fill="#000"
                />
              </g>

              <g id="lines">
                <line
                  x1="0"
                  y1={HORIZON_Y}
                  x2={VIEW_W}
                  y2={HORIZON_Y}
                  stroke="rgba(148,163,184,0.78)"
                  strokeWidth="0.6"
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
              </g>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
