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
  DASHBOARD_METRIC_LABEL_CLASS,
  DASHBOARD_PANEL_CLASS,
  DASHBOARD_PANEL_TITLE_CLASS,
  formatTimeOrDateTime,
} from "./moonDashboardShared";
import nightStars from "../../public/sky/night-starfield.jpg";

const VIEW_W = 160;
const VIEW_H = 36;
const HORIZON_Y = 21;
const AMP = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

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

function formatTwilightLabel(value: string | null | undefined): string {
  if (!value) return "—";

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
  const hasPartialTimeline =
    summary.twilight.segments.length === 0 ||
    summary.sun.sunrise === null ||
    summary.sun.sunset === null;
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

  const localDate = summary.meta.requested_datetime.date;
  const dayStartMs = fromZonedTime(`${localDate}T00:00:00`, tz).getTime();
  const dayEndMs = fromZonedTime(
    `${nextDateIso(localDate)}T00:00:00`,
    tz,
  ).getTime();

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
  const nowX = timeToX(nowMs, dayStartMs, dayEndMs);
  const moonDotX = nowX;
  const sunDotX = nowX;
  const moonDotY = buildOrbitCurveY({
    dayStartMs,
    dayEndMs,
    nowMs,
    riseMs: moonriseMs,
    setMs: moonsetMs,
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
  const moonCurvePath =
    moonriseMs !== null || moonsetMs !== null
      ? buildTimedOrbitPath({
          dayStartMs,
          dayEndMs,
          riseMs: moonriseMs,
          setMs: moonsetMs,
          isUp: summary.moon.is_up,
        })
      : CURVE_PATH;

  const skyStripes = buildSkyStripes(twilightBands, dayStartMs, dayEndMs);
  const weatherCondition = weatherQ.data?.condition;
  const weatherCloudCover = clamp01((weatherQ.data?.cloudCoverPct ?? 0) / 100);
  const weatherSkyImageUrl = resolveWeatherSkyImage(weatherCondition);
  const nightSkyStrength = lerp(0.96, 0.64, weatherCloudCover);
  const weatherSkyStrength = lerp(0.78, 0.96, weatherCloudCover);
  const skyShadowOpacity = lerp(0.05, 0.16, weatherCloudCover);
  const weatherAtmosphereOpacity = lerp(0.03, 0.12, weatherCloudCover);

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
  const moonriseLegendLabel = summary.moon.moonrise
    ? formatInTimeZone(new Date(summary.moon.moonrise), tz, "h:mm a")
    : "—";
  const moonsetLegendLabel = summary.moon.moonset
    ? formatInTimeZone(new Date(summary.moon.moonset), tz, "h:mm a")
    : "—";
  const compactContextItems = [
    {
      label: "Twilight",
      value: formatTwilightLabel(summary.twilight.current_phase),
      detail: `Next transition ${formatTimeOrDateTime(summary.twilight.next_transition ?? undefined, tz)}`,
    },
    {
      label: "Moon altitude",
      value: formatDegrees(summary.moon.altitude_deg),
      detail: `${formatAzimuthWithDirection(summary.moon.azimuth_deg)} · ${formatVisibilityLabel(summary.moon.is_up)}`,
    },
    {
      label: "Sun altitude",
      value: formatDegrees(summary.sun.altitude_deg),
      detail: `${formatAzimuthWithDirection(summary.sun.azimuth_deg)} · ${formatVisibilityLabel(summary.sun.is_up)}`,
    },
    {
      label: "Moonset",
      value: moonsetLegendLabel,
      detail: "Moon drops below the horizon.",
    },
    {
      label: "Sunrise",
      value: sunriseLegendLabel,
      detail: "Sun reaches the horizon.",
    },
    {
      label: "Sunset",
      value: sunsetLegendLabel,
      detail: "Sun drops below the horizon.",
    },
  ];

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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-sky-100/70">
            <span
              className="h-1.5 w-1.5 rounded-full ring-1 ring-white/20"
              style={{ backgroundColor: TWILIGHT_BAND_COLOR[twilightPhase] }}
            />
            Twilight {twilightLabel}
          </span>
        </div>
        <div className="whitespace-nowrap text-[10px] text-slate-400/66">
          Updated {lastUpdatedLabel}
          {summaryQ.isFetching ? " · updating" : ""}
        </div>
      </header>

      {timelineStatus ? (
        <DashboardStatusBanner tone={timelineStatus.tone}>
          {timelineStatus.message}
        </DashboardStatusBanner>
      ) : null}

      <div className="overflow-hidden rounded-[1rem] border border-white/10 bg-black/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
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

      <div className="border-t border-white/8 pt-2.5">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-200/68">
          {TWILIGHT_LEGEND_ORDER.map((phase) => (
            <span
              key={phase}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1"
            >
              <span
                className="h-2 w-2 rounded-sm ring-1 ring-white/15"
                style={{ backgroundColor: TWILIGHT_BAND_COLOR[phase] }}
              />
              <span className="uppercase tracking-[0.14em] text-sky-100/58">
                {TWILIGHT_LABEL[phase]}
              </span>
              <span className="font-semibold tracking-normal text-slate-100">
                {nextPhaseStartLabel[phase]}
              </span>
            </span>
          ))}
        </div>

        <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {compactContextItems.map((item) => (
            <div
              key={item.label}
              className="rounded-[0.95rem] border border-white/8 bg-white/[0.025] px-2.5 py-2"
            >
              <div className={DASHBOARD_METRIC_LABEL_CLASS}>{item.label}</div>
              <div className="mt-1 text-sm font-semibold leading-tight text-slate-100">
                {item.value}
              </div>
              <div className="mt-1 text-[10px] leading-relaxed text-slate-300/62">
                {item.detail}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
