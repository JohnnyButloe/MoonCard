"use client";

import { useId } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { useAstronomySummary } from "../hooks/useAstronomy";
import type { AstronomySummary } from "../providers/pyAstronomy";
import { MoonPhaseCircle } from "./MoonPhaseCircle";

const VIEW_W = 160;
const VIEW_H = 40;
const HORIZON_Y = 24;
const AMP = 14;

type TwilightPhase = "dark" | "astronomical" | "nautical" | "civil" | "day";

type RGB = { r: number; g: number; b: number };

type SkyStripe = {
  x: number;
  width: number;
  zenith: RGB;
  horizon: RGB;
  sunAltDeg: number;
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

type SunPathSample = AstronomySummary["sun"]["path"]["samples"][number];

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

const SKY_KEYS_ASC = [
  { alt: -40, zenith: { r: 3, g: 4, b: 12 }, horizon: { r: 3, g: 4, b: 12 } },
  {
    alt: -18,
    zenith: { r: 6, g: 8, b: 22 },
    horizon: { r: 25, g: 20, b: 40 },
  },
  {
    alt: -12,
    zenith: { r: 12, g: 18, b: 45 },
    horizon: { r: 120, g: 80, b: 140 },
  },
  {
    alt: -6,
    zenith: { r: 20, g: 35, b: 70 },
    horizon: { r: 255, g: 140, b: 80 },
  },
  {
    alt: 5,
    zenith: { r: 30, g: 55, b: 120 },
    horizon: { r: 240, g: 190, b: 120 },
  },
  {
    alt: 30,
    zenith: { r: 25, g: 70, b: 145 },
    horizon: { r: 140, g: 195, b: 230 },
  },
  {
    alt: 80,
    zenith: { r: 35, g: 90, b: 165 },
    horizon: { r: 170, g: 210, b: 235 },
  },
];

function skyColorsForSunAlt(sunAltDeg: number) {
  const keys = SKY_KEYS_ASC;
  if (!keys.length) {
    return {
      zenith: { r: 8, g: 12, b: 24 },
      horizon: { r: 8, g: 12, b: 24 },
    };
  }
  if (!Number.isFinite(sunAltDeg)) {
    return { zenith: keys[0].zenith, horizon: keys[0].horizon };
  }

  const first = keys[0];
  const last = keys[keys.length - 1];
  const clampedAlt = Math.max(first.alt, Math.min(last.alt, sunAltDeg));

  if (clampedAlt <= first.alt) {
    return { zenith: first.zenith, horizon: first.horizon };
  }
  if (clampedAlt >= last.alt) {
    return { zenith: last.zenith, horizon: last.horizon };
  }

  let k = 0;
  while (k < keys.length - 2 && clampedAlt > keys[k + 1].alt) {
    k += 1;
  }

  const a = keys[k];
  const b = keys[k + 1];
  const denom = b.alt - a.alt;
  if (!Number.isFinite(denom) || denom === 0) {
    return { zenith: a.zenith, horizon: a.horizon };
  }
  const t = clamp01((clampedAlt - a.alt) / denom);

  return {
    zenith: lerpRgb(a.zenith, b.zenith, t),
    horizon: lerpRgb(a.horizon, b.horizon, t),
  };
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

function buildSkyStripes(samples: SunPathSample[]): SkyStripe[] {
  if (!samples.length) return [];
  const count = Math.max(2, samples.length);
  const colW = VIEW_W / (count - 1);

  return samples.map((sample, index) => {
    const colors = skyColorsForSunAlt(sample.altitude_deg);
    return {
      x: index * colW,
      width: colW + 1,
      zenith: colors.zenith,
      horizon: colors.horizon,
      sunAltDeg: sample.altitude_deg,
    };
  });
}

function buildStars(stripes: SkyStripe[]): Star[] {
  const stars: Star[] = [];

  for (let i = 0; i < stripes.length; i += 1) {
    const stripe = stripes[i];
    if (stripe.sunAltDeg > -8) continue;

    const darkness = clamp01((-stripe.sunAltDeg - 8) / 20);
    const chance = 0.12 + darkness * 0.24;
    if (noise(i + 11) > chance) continue;

    stars.push({
      x: stripe.x + stripe.width * noise(i + 31),
      y: 2 + noise(i + 59) * (HORIZON_Y * 0.62),
      r: 0.1 + noise(i + 79) * 0.18,
      opacity: 0.35 + darkness * 0.45 + noise(i + 101) * 0.08,
    });
  }

  return stars;
}

function buildClouds(stripes: SkyStripe[]): Cloud[] {
  const clouds: Cloud[] = [];

  for (let i = 0; i < stripes.length; i += 10) {
    const stripe = stripes[i];
    if (stripe.sunAltDeg < -3) continue;
    if (noise(i + 211) > 0.42) continue;

    const daylight = clamp01((stripe.sunAltDeg + 3) / 24);
    clouds.push({
      x: stripe.x + stripe.width * 0.5,
      y: 4 + noise(i + 223) * (HORIZON_Y * 0.42),
      width: 7 + noise(i + 227) * 10,
      height: 1.6 + noise(i + 229) * 2.8,
      opacity: 0.05 + daylight * 0.08 + noise(i + 233) * 0.03,
    });
  }

  return clouds;
}

const CURVE_PATH = buildCurvePath(220);

export default function MoonAltitudeGraph({
  lat,
  lon,
  tz,
}: {
  lat: number;
  lon: number;
  tz: string;
}) {
  const summaryQ = useAstronomySummary(lat, lon, tz);
  const idPrefix = useId().replace(/:/g, "-");

  if (!summaryQ.data || summaryQ.error) return null;

  const summary = summaryQ.data;
  const now = new Date(summary.meta.date.current_local);
  const nowMs = now.getTime();

  const riseIso = summary.moon.events.rise_local ?? undefined;
  const setIso = summary.moon.events.set_local ?? undefined;
  const rise = riseIso ? new Date(riseIso) : null;
  const set = setIso ? new Date(setIso) : null;
  const prevSetIso = summary.moon.events.previous_set_local ?? undefined;
  const nextRiseIso = summary.moon.events.rise_local ?? undefined;

  let cycleT = 0.25;
  if (
    prevSetIso &&
    nextRiseIso &&
    Number.isFinite(new Date(prevSetIso).getTime()) &&
    Number.isFinite(new Date(nextRiseIso).getTime())
  ) {
    const prevSetDate = new Date(prevSetIso);
    const nextRiseDate = new Date(nextRiseIso);
    if (
      now.getTime() >= prevSetDate.getTime() &&
      now.getTime() <= nextRiseDate.getTime()
    ) {
      const span = nextRiseDate.getTime() - prevSetDate.getTime();
      const pct = span > 0 ? (now.getTime() - prevSetDate.getTime()) / span : 0;
      cycleT = 0.75 + pct * 0.25;
    } else if (rise && set) {
      const span = set.getTime() - rise.getTime();
      if (span > 0) {
        const pad = span / 2;
        const start = rise.getTime() - pad;
        const end = set.getTime() + pad;
        const total = end - start;
        if (total > 0) cycleT = (now.getTime() - start) / total;
      }
    }
  } else if (rise && set) {
    const span = set.getTime() - rise.getTime();
    if (span > 0) {
      const pad = span / 2;
      const start = rise.getTime() - pad;
      const end = set.getTime() + pad;
      const total = end - start;
      if (total > 0) cycleT = (now.getTime() - start) / total;
    }
  }
  cycleT = clamp01(cycleT);

  const sunPathStart = new Date(summary.sun.path.window_start_local).getTime();
  const sunPathEnd = new Date(summary.sun.path.window_end_local).getTime();
  let sunCycleT = 0.25;
  if (
    Number.isFinite(sunPathStart) &&
    Number.isFinite(sunPathEnd) &&
    sunPathEnd > sunPathStart
  ) {
    sunCycleT = (nowMs - sunPathStart) / (sunPathEnd - sunPathStart);
  }
  sunCycleT = clamp01(sunCycleT);

  const dotX = cycleT * VIEW_W;
  const dotY = yOnCurve(cycleT);
  const sunDotX = sunCycleT * VIEW_W;
  const sunDotY = yOnCurve(sunCycleT);

  const moonMarker = summary.moon.current;
  const twilightPhase = normalizeTwilightPhase(summary.twilight.current_phase);
  const twilightLabel = TWILIGHT_LABEL[twilightPhase];

  const skyStripes = buildSkyStripes(summary.sun.path.samples);
  const stars = buildStars(skyStripes);
  const clouds = buildClouds(skyStripes);

  const twilightBands = summary.twilight.segments
    .map((segment) => ({
      startMs: new Date(segment.start_local).getTime(),
      endMs: new Date(segment.end_local).getTime(),
      phase: normalizeTwilightPhase(segment.phase),
    }))
    .filter(
      (segment) =>
        Number.isFinite(segment.startMs) &&
        Number.isFinite(segment.endMs) &&
        segment.endMs > segment.startMs,
    )
    .sort((a, b) => a.startMs - b.startMs);

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
      const nextStartMs = upcoming ?? starts[0] + 24 * 60 * 60 * 1000;
      acc[phase] = formatInTimeZone(new Date(nextStartMs), tz, "h:mm a");
      return acc;
    },
    {} as Record<TwilightPhase, string>,
  );

  const sunriseLegendIso =
    summary.twilight.sun_events.sunrise_local ?? summary.sun.events.sunrise_local ?? null;
  const sunsetLegendIso =
    summary.twilight.sun_events.sunset_local ?? summary.sun.events.sunset_local ?? null;
  const sunriseLegendLabel = sunriseLegendIso
    ? formatInTimeZone(new Date(sunriseLegendIso), tz, "h:mm a")
    : "—";
  const sunsetLegendLabel = sunsetLegendIso
    ? formatInTimeZone(new Date(sunsetLegendIso), tz, "h:mm a")
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
    <div className="w-full rounded-2xl bg-slate-950/68 p-5 ring-1 ring-white/12 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.3em] text-sky-200/60">
          Moon/Sun altitude
        </div>
        <div className="text-[11px] text-sky-100/70">
          Updated {lastUpdatedLabel}
          {summaryQ.isFetching ? " · updating" : ""}
        </div>
      </div>

      <div className="aspect-[5/1.35] w-full overflow-hidden rounded-xl bg-black/60">
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

            <filter
              id={auraBlurId}
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur stdDeviation="10" />
            </filter>

            <filter
              id={cloudBlurId}
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur stdDeviation="1.2" />
            </filter>

            <filter
              id={starGlowId}
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
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
                fill="rgba(0,0,0,0.10)"
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
                stroke="#6b7280"
                strokeWidth="0.6"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={CURVE_PATH}
                stroke="#9ca3af"
                strokeWidth="1.2"
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
                r={2.25}
                size={16}
                illuminationFrac={moonMarker.illumination_frac}
                waxing={moonMarker.waxing}
                phaseAngleDeg={moonMarker.phase_angle_deg}
                brightLimbAngleDeg={moonMarker.bright_limb_angle_deg}
              />
              <circle cx={sunDotX} cy={sunDotY} r="2" fill="#fde047" />
            </g>
          </g>
        </svg>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-sky-100/70">
        <div className="inline-flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full ring-1 ring-white/20"
            style={{ backgroundColor: TWILIGHT_BAND_COLOR[twilightPhase] }}
          />
          Twilight phase: <span className="font-semibold">{twilightLabel}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.12em] text-sky-100/55">
        {TWILIGHT_LEGEND_ORDER.map((phase) => (
          <span key={phase} className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-sm ring-1 ring-white/15"
              style={{ backgroundColor: TWILIGHT_BAND_COLOR[phase] }}
            />
            <span className="inline-flex flex-col leading-tight">
              <span>{TWILIGHT_LABEL[phase]}</span>
              <span className="text-[10px] normal-case tracking-normal text-sky-100/45">
                {nextPhaseStartLabel[phase]}
              </span>
            </span>
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-sky-100/65">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-yellow-200 ring-1 ring-white/15" />
          Sunrise <span className="font-semibold">{sunriseLegendLabel}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-orange-300 ring-1 ring-white/15" />
          Sunset <span className="font-semibold">{sunsetLegendLabel}</span>
        </span>
      </div>
    </div>
  );
}
