"use client";

import { useId } from "react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { useMoonCard } from "../hooks/useAstronomy";
import {
  DashboardPanelState,
  DashboardSkeletonBlock,
  DashboardStatusBanner,
} from "./DashboardState";
import { MoonPhaseCircle } from "./MoonPhaseCircle";

const VIEW_W = 160;
const VIEW_H = 36;
const HORIZON_Y = 21;
const AMP = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

type TwilightPhase = "dark" | "astronomical" | "nautical" | "civil" | "day";

type RGB = { r: number; g: number; b: number };

type SkyStripe = {
  x: number;
  width: number;
  zenith: RGB;
  horizon: RGB;
  phase: TwilightPhase;
};

type Star = {
  x: number;
  y: number;
  r: number;
  opacity: number;
};

type Cloud = {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
};

type TwilightBand = {
  startMs: number;
  endMs: number;
  phase: TwilightPhase;
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

const TWILIGHT_LEGEND_ORDER: TwilightPhase[] = [
  "day",
  "civil",
  "nautical",
  "astronomical",
  "dark",
];

const SKY_PHASE_COLORS: Record<TwilightPhase, { zenith: RGB; horizon: RGB }> = {
  day: {
    zenith: { r: 35, g: 90, b: 165 },
    horizon: { r: 170, g: 210, b: 235 },
  },
  civil: {
    zenith: { r: 28, g: 60, b: 128 },
    horizon: { r: 245, g: 188, b: 126 },
  },
  nautical: {
    zenith: { r: 18, g: 34, b: 80 },
    horizon: { r: 104, g: 78, b: 154 },
  },
  astronomical: {
    zenith: { r: 8, g: 12, b: 28 },
    horizon: { r: 34, g: 24, b: 60 },
  },
  dark: {
    zenith: { r: 3, g: 4, b: 12 },
    horizon: { r: 3, g: 4, b: 12 },
  },
};

const PHASE_DARKNESS: Record<TwilightPhase, number> = {
  day: 0,
  civil: 0.08,
  nautical: 0.45,
  astronomical: 0.85,
  dark: 1,
};

const PHASE_DAYLIGHT: Record<TwilightPhase, number> = {
  day: 1,
  civil: 0.72,
  nautical: 0.2,
  astronomical: 0.05,
  dark: 0,
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

const lerpRgb = (a: RGB, b: RGB, t: number): RGB => ({
  r: lerp(a.r, b.r, t),
  g: lerp(a.g, b.g, t),
  b: lerp(a.b, b.b, t),
});

function rgbToCss(c: RGB, a = 1) {
  return `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${a})`;
}

function noise(seed: number) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return value - Math.floor(value);
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
      startMs: Math.max(input.dayStartMs, Math.min(input.dayEndMs, segment.startMs)),
      endMs: Math.max(input.dayStartMs, Math.min(input.dayEndMs, segment.endMs)),
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
    const colors = SKY_PHASE_COLORS[band.phase];
    const x = timeToX(band.startMs, dayStartMs, dayEndMs);
    const endX = timeToX(band.endMs, dayStartMs, dayEndMs);

    return {
      x,
      width: Math.max(0.8, endX - x),
      zenith: colors.zenith,
      horizon: colors.horizon,
      phase: band.phase,
    };
  });
}

function buildStars(stripes: SkyStripe[]): Star[] {
  const stars: Star[] = [];

  for (let i = 0; i < stripes.length; i += 1) {
    const stripe = stripes[i];
    const darkness = PHASE_DARKNESS[stripe.phase];
    if (darkness < 0.35) continue;

    const starCount = Math.max(1, Math.round(2 + darkness * 5));
    for (let j = 0; j < starCount; j += 1) {
      const seed = i * 17 + j;
      if (noise(seed + 11) > 0.82) continue;

      stars.push({
        x: stripe.x + stripe.width * noise(seed + 31),
        y: 2 + noise(seed + 59) * (HORIZON_Y * 0.62),
        r: 0.1 + noise(seed + 79) * 0.18,
        opacity: 0.35 + darkness * 0.45 + noise(seed + 101) * 0.08,
      });
    }
  }

  return stars;
}

function buildClouds(stripes: SkyStripe[]): Cloud[] {
  const clouds: Cloud[] = [];

  for (let i = 0; i < stripes.length; i += 1) {
    const stripe = stripes[i];
    const daylight = PHASE_DAYLIGHT[stripe.phase];
    if (daylight < 0.25) continue;
    if (noise(i + 211) > 0.42) continue;

    clouds.push({
      x: stripe.x + stripe.width * (0.25 + noise(i + 223) * 0.5),
      y: 4 + noise(i + 227) * (HORIZON_Y * 0.42),
      width: 7 + noise(i + 229) * 10,
      height: 1.6 + noise(i + 233) * 2.8,
      opacity: 0.04 + daylight * 0.08 + noise(i + 239) * 0.03,
    });
  }

  return clouds;
}

function buildCyclePosition(input: {
  nowMs: number;
  dayStartMs: number;
  dayEndMs: number;
  riseMs: number | null;
  setMs: number | null;
  isUp: boolean | null;
}): number {
  const daySpan = Math.max(1, input.dayEndMs - input.dayStartMs);
  const nowClamped = Math.max(input.dayStartMs, Math.min(input.dayEndMs, input.nowMs));
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
      return clamp01((nowClamped - input.dayStartMs) / Math.max(1, riseMs - input.dayStartMs)) * 0.25;
    }

    if (nowClamped <= setMs) {
      return 0.25 + ((nowClamped - riseMs) / Math.max(1, setMs - riseMs)) * 0.5;
    }

    return 0.75 + ((nowClamped - setMs) / Math.max(1, input.dayEndMs - setMs)) * 0.25;
  }

  if (input.isUp === true) {
    return 0.5;
  }

  if (input.isUp === false) {
    return fallback < 0.5 ? 0.12 : 0.88;
  }

  return fallback;
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
      <div className="flex min-h-[18rem] w-full flex-col gap-3 rounded-[1.5rem] bg-slate-950/70 p-4 ring-1 ring-white/10 shadow-lg shadow-black/25 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <DashboardSkeletonBlock className="h-2 w-28 rounded-full" />
            <DashboardSkeletonBlock className="h-4 w-36" />
          </div>
          <div className="flex gap-2">
            <DashboardSkeletonBlock className="h-6 w-20 rounded-full" />
            <DashboardSkeletonBlock className="h-6 w-16 rounded-full" />
          </div>
        </div>

        <DashboardSkeletonBlock className="h-[10rem] rounded-[1rem]" />

        <div className="flex flex-wrap gap-1.5">
          <DashboardSkeletonBlock className="h-6 w-24 rounded-full" />
          <DashboardSkeletonBlock className="h-6 w-24 rounded-full" />
        </div>

        <div className="grid grid-cols-2 gap-1.5 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <DashboardSkeletonBlock
              key={`moon-graph-skeleton-${index}`}
              className="h-12 rounded-lg"
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
  const hasPartialTimeline =
    summary.twilight.segments.length === 0 ||
    summary.sun.sunrise === null ||
    summary.sun.sunset === null;
  const timelineStatus =
    summaryQ.error
      ? {
          tone: "warning" as const,
          message: "Timeline refresh failed. Showing the last update.",
        }
      : hasCanonicalSummaryIssues
        ? {
            tone: "warning" as const,
            message: "Astronomy data is degraded. Some timeline moments may be limited.",
          }
        : hasPartialTimeline
          ? {
              tone: "neutral" as const,
              message: "Timeline is using partial astronomy data.",
            }
          : null;

  const localDate = summary.meta.requested_datetime.date;
  const dayStartMs = fromZonedTime(`${localDate}T00:00:00`, tz).getTime();
  const dayEndMs = fromZonedTime(`${nextDateIso(localDate)}T00:00:00`, tz).getTime();

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

  const cycleT = buildCyclePosition({
    nowMs,
    dayStartMs,
    dayEndMs,
    riseMs: toUtcMs(summary.moon.moonrise),
    setMs: toUtcMs(summary.moon.moonset),
    isUp: summary.moon.is_up,
  });
  const sunCycleT = buildCyclePosition({
    nowMs,
    dayStartMs,
    dayEndMs,
    riseMs: toUtcMs(summary.sun.sunrise),
    setMs: toUtcMs(summary.sun.sunset),
    isUp: summary.sun.is_up,
  });

  const dotX = cycleT * VIEW_W;
  const dotY = yOnCurve(cycleT);
  const sunDotX = sunCycleT * VIEW_W;
  const sunDotY = yOnCurve(sunCycleT);

  const skyStripes = buildSkyStripes(twilightBands, dayStartMs, dayEndMs);
  const stars = buildStars(skyStripes);
  const clouds = buildClouds(skyStripes);

  const nextPhaseStartLabel = TWILIGHT_LEGEND_ORDER.reduce(
    (acc, phase) => {
      const starts = twilightBands
        .filter((band) => band.phase === phase)
        .map((band) => band.startMs)
        .sort((a, b) => a - b);

      if (!starts.length) {
        acc[phase] = "—";
        return acc;
      }

      const upcoming = starts.find((startMs) => startMs >= nowMs);
      const nextStartMs = upcoming ?? starts[0] + DAY_MS;
      acc[phase] = formatInTimeZone(new Date(nextStartMs), tz, "h:mm a");
      return acc;
    },
    {} as Record<TwilightPhase, string>,
  );

  const sunriseLegendLabel = summary.sun.sunrise
    ? formatInTimeZone(new Date(summary.sun.sunrise), tz, "h:mm a")
    : "—";
  const sunsetLegendLabel = summary.sun.sunset
    ? formatInTimeZone(new Date(summary.sun.sunset), tz, "h:mm a")
    : "—";

  const lastUpdatedLabel = summaryQ.dataUpdatedAt
    ? formatInTimeZone(new Date(summaryQ.dataUpdatedAt), tz, "h:mm a")
    : "—";

  const plotClipId = `${idPrefix}-plotClip`;
  const aboveHorizonClipId = `${idPrefix}-aboveHorizon`;
  const auraBlurId = `${idPrefix}-auraBlur`;
  const cloudBlurId = `${idPrefix}-cloudBlur`;
  const starGlowId = `${idPrefix}-starGlow`;

  return (
    <div className="min-h-[18rem] w-full rounded-[1.5rem] bg-slate-950/70 p-4 ring-1 ring-white/10 shadow-lg shadow-black/25 backdrop-blur">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2.5 sm:flex-nowrap">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.26em] text-sky-200/52">
            Altitude timeline
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-slate-50">
              Moon/Sun altitude
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-sky-100/70">
              <span
                className="h-1.5 w-1.5 rounded-full ring-1 ring-white/20"
                style={{ backgroundColor: TWILIGHT_BAND_COLOR[twilightPhase] }}
              />
              Twilight {twilightLabel}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start">
          <div className="whitespace-nowrap text-[10px] text-slate-300/70">
            Updated {lastUpdatedLabel}
            {summaryQ.isFetching ? " · updating" : ""}
          </div>
          <button
            type="button"
            disabled
            aria-label="Expand chart view is not available yet"
            title="Expand chart view coming soon"
            className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400/65 disabled:cursor-default"
          >
            Expand
          </button>
        </div>
      </header>

      {timelineStatus ? (
        <DashboardStatusBanner tone={timelineStatus.tone} className="mb-3">
          {timelineStatus.message}
        </DashboardStatusBanner>
      ) : null}

      <div className="overflow-hidden rounded-[1rem] border border-white/10 bg-black/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="aspect-[5/1.18] w-full">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="none"
            className="block h-full w-full"
            style={{ isolation: "isolate" }}
          >
            <defs>
              <clipPath id={plotClipId}>
                <rect x="0" y="0" width={VIEW_W} height={VIEW_H} rx="2.5" ry="2.5" />
              </clipPath>

              <clipPath id={aboveHorizonClipId}>
                <rect x="0" y="0" width={VIEW_W} height={HORIZON_Y} />
              </clipPath>

              <filter id={auraBlurId} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="10" />
              </filter>

              <filter id={cloudBlurId} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.2" />
              </filter>

              <filter id={starGlowId} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="0.12" />
              </filter>

              {skyStripes.map((stripe, idx) => {
                const gradId = `${idPrefix}-sky-${idx}`;
                const mid = lerpRgb(stripe.zenith, stripe.horizon, 0.4);

                return (
                  <linearGradient key={gradId} id={gradId} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={rgbToCss(stripe.zenith, 1)} />
                    <stop offset="65%" stopColor={rgbToCss(mid, 1)} />
                    <stop offset="100%" stopColor={rgbToCss(stripe.horizon, 1)} />
                  </linearGradient>
                );
              })}
            </defs>

            <g clipPath={`url(#${plotClipId})`}>
              <g id="bg">
                {skyStripes.map((stripe, idx) => (
                  <rect
                    key={`sky-col-${idx}`}
                    x={stripe.x}
                    y="0"
                    width={stripe.width}
                    height={HORIZON_Y}
                    fill={`url(#${idPrefix}-sky-${idx})`}
                  />
                ))}
                <rect
                  x="0"
                  y="0"
                  width={VIEW_W}
                  height={HORIZON_Y}
                  fill="rgba(0,0,0,0.12)"
                />
                <rect
                  x="0"
                  y={HORIZON_Y}
                  width={VIEW_W}
                  height={VIEW_H - HORIZON_Y}
                  fill="#000"
                />
              </g>

              <g
                id="stars"
                clipPath={`url(#${aboveHorizonClipId})`}
                filter={`url(#${starGlowId})`}
              >
                {stars.map((star, idx) => (
                  <g key={`star-${idx}`} opacity={star.opacity}>
                    <circle cx={star.x} cy={star.y} r={star.r} fill="#f8fafc" />
                    {star.r > 0.22 ? (
                      <path
                        d={`M ${formatPathNumber(star.x - star.r * 1.35)},${formatPathNumber(star.y)} L ${formatPathNumber(star.x + star.r * 1.35)},${formatPathNumber(star.y)} M ${formatPathNumber(star.x)},${formatPathNumber(star.y - star.r * 1.35)} L ${formatPathNumber(star.x)},${formatPathNumber(star.y + star.r * 1.35)}`}
                        stroke="rgba(248,250,252,0.5)"
                        strokeWidth="0.08"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : null}
                  </g>
                ))}
              </g>

              <g
                id="clouds"
                clipPath={`url(#${aboveHorizonClipId})`}
                filter={`url(#${cloudBlurId})`}
              >
                {clouds.map((cloud, idx) => (
                  <g key={`cloud-${idx}`} opacity={cloud.opacity}>
                    <ellipse
                      cx={cloud.x}
                      cy={cloud.y}
                      rx={cloud.width * 0.28}
                      ry={cloud.height * 0.62}
                      fill="rgba(255,255,255,0.95)"
                    />
                    <ellipse
                      cx={cloud.x - cloud.width * 0.18}
                      cy={cloud.y + cloud.height * 0.08}
                      rx={cloud.width * 0.2}
                      ry={cloud.height * 0.5}
                      fill="rgba(255,255,255,0.86)"
                    />
                    <ellipse
                      cx={cloud.x + cloud.width * 0.16}
                      cy={cloud.y + cloud.height * 0.1}
                      rx={cloud.width * 0.22}
                      ry={cloud.height * 0.48}
                      fill="rgba(255,255,255,0.82)"
                    />
                  </g>
                ))}
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
                  d={CURVE_PATH}
                  stroke="rgba(191,219,254,0.8)"
                  strokeWidth="1.05"
                  vectorEffect="non-scaling-stroke"
                  fill="none"
                />
              </g>

              <g
                id="glow-contrast"
                clipPath={`url(#${aboveHorizonClipId})`}
                filter={`url(#${auraBlurId})`}
              >
                <circle cx={dotX} cy={dotY} r="12" fill="#020617" opacity="0.16" />
                <circle cx={sunDotX} cy={sunDotY} r="10" fill="#020617" opacity="0.12" />
              </g>

              <g
                id="glow"
                clipPath={`url(#${aboveHorizonClipId})`}
                style={{ mixBlendMode: "screen" }}
                filter={`url(#${auraBlurId})`}
              >
                <circle cx={dotX} cy={dotY} r="16" fill="rgba(180,210,255,0.38)" />
                <circle cx={sunDotX} cy={sunDotY} r="14" fill="rgba(255,220,120,0.46)" />
              </g>

              <g id="markers">
                <MoonPhaseCircle
                  mode="g"
                  cx={dotX}
                  cy={dotY}
                  r={2.1}
                  size={15}
                  illuminationFrac={summary.moon.illumination_fraction ?? undefined}
                  phaseAngleDeg={summary.moon.phase_angle_deg ?? undefined}
                />
                <circle cx={sunDotX} cy={sunDotY} r="1.8" fill="#fde047" />
              </g>
            </g>
          </svg>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-200/72">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
          <span className="h-2 w-2 rounded-full bg-yellow-200 ring-1 ring-white/15" />
          Sunrise <span className="font-semibold text-slate-100">{sunriseLegendLabel}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
          <span className="h-2 w-2 rounded-full bg-orange-300 ring-1 ring-white/15" />
          Sunset <span className="font-semibold text-slate-100">{sunsetLegendLabel}</span>
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] md:grid-cols-5">
        {TWILIGHT_LEGEND_ORDER.map((phase) => (
          <div
            key={phase}
            className="rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1.5"
          >
            <div className="flex items-center gap-1.5 uppercase tracking-[0.14em] text-sky-100/58">
              <span
                className="h-2 w-2 rounded-sm ring-1 ring-white/15"
                style={{ backgroundColor: TWILIGHT_BAND_COLOR[phase] }}
              />
              <span>{TWILIGHT_LABEL[phase]}</span>
            </div>
            <div className="mt-1 text-xs font-medium tracking-normal text-slate-100">
              {nextPhaseStartLabel[phase]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
