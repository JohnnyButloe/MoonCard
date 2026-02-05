// app/components/MoonGraph.tsx
"use client";

import { useLunarNow, useMoonToday } from "../hooks/useLunar";
import { useQuery } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import next from "next";

// SVG coordinates space (wide + short)
const VIEW_W = 100;
const VIEW_H = 40;

// Horizon runs through the graph
const HORIZON_Y = 24;

// Curve amplitude (peak above horizon, trough below horizon)
const AMP = 14;

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

// Full “day/night” sine curve:
// t=0   -> below horizon
// t=0.25-> horizon (rise)
// t=0.5 -> peak (high)
// t=0.75-> horizon (set)
// t=1   -> below horizon
function yOnCurve(t: number) {
  return HORIZON_Y - AMP * Math.sin(2 * Math.PI * t - Math.PI / 2);
}

function buildCurvePath(samples = 200) {
  let d = "";
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = t * VIEW_W;
    const y = yOnCurve(t);
    d += `${i === 0 ? "M" : "L"} ${x},${y} `;
  }
  return d.trim();
}

const CURVE_PATH = buildCurvePath(200);

export default function MoonAltitudeGraph({
  lat,
  lon,
  tz,
}: {
  lat: number;
  lon: number;
  tz: string;
}) {
  const nowQ = useLunarNow(lat, lon, tz);
  const todayQ = useMoonToday(lat, lon, tz);

  // Fetch sun rise/set times directly from the /api/py-sun endpoint.
  // The query computes the local date in the given timezone and requests
  // sunriseLocal and sunsetLocal. It refreshes every 10 minutes.
  const sunQ = useQuery<{
    sunriseLocal?: string | null;
    sunsetLocal?: string | null;
  }>({
    queryKey: ["sun", lat, lon, tz],
    queryFn: async () => {
      const now = new Date();
      const dateIso = formatInTimeZone(now, tz, "yyyy-MM-dd");
      const url = new URL("/api/py-sun", location.origin);
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lon));
      url.searchParams.set("date_iso", dateIso);
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error("py-sun-failed");
      return res.json();
    },
    refetchInterval: 10 * 60 * 1000,
  });

  // Only render once lunar data is ready
  const ready =
    !!nowQ.data &&
    !!todayQ.data &&
    !nowQ.isLoading &&
    !todayQ.isLoading &&
    !nowQ.error &&
    !todayQ.error;

  if (!ready) return null;

  const nowIso = nowQ.data!.whenISO;
  const now = new Date(nowIso);

  // choose rise/set for the next moon event (internal preferred, external fallback)
  const riseIso =
    todayQ.data!.internal.rise ?? todayQ.data!.external.rise ?? undefined;
  const setIso =
    todayQ.data!.internal.set ?? todayQ.data!.external.set ?? undefined;
  const rise = riseIso ? new Date(riseIso) : null;
  const set = setIso ? new Date(setIso) : null;

  // previous set and next rise to handle post-moonset interpolation
  const prevSetIso =
    todayQ.data!.internal.prevSet ?? todayQ.data!.external.prevSet;
  const nextRiseIso = todayQ.data!.internal.rise ?? todayQ.data!.external.rise;

  // compute moon cycle position
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
      // after moonset and before the next moonrise:
      // interpolate across final quarter (0.75–1.0)
      const span = nextRiseDate.getTime() - prevSetDate.getTime();
      const pct = span > 0 ? (now.getTime() - prevSetDate.getTime()) / span : 0;
      cycleT = 0.75 + pct * 0.25;
    } else if (rise && set) {
      // otherwise, use the standard rise/set mapping with padding
      const span = set.getTime() - rise.getTime();
      if (span > 0) {
        const pad = span / 2;
        const start = rise.getTime() - pad;
        const end = set.getTime() + pad;
        const total = end - start;
        if (total > 0) {
          cycleT = (now.getTime() - start) / total;
        }
      }
    }
  } else if (rise && set) {
    // fallback if prevSet or nextRise are missing
    const span = set.getTime() - rise.getTime();
    if (span > 0) {
      const pad = span / 2;
      const start = rise.getTime() - pad;
      const end = set.getTime() + pad;
      const total = end - start;
      if (total > 0) {
        cycleT = (now.getTime() - start) / total;
      }
    }
  }

  cycleT = clamp01(cycleT);
  const dotX = cycleT * VIEW_W;
  const dotY = yOnCurve(cycleT);

  // Sun position: pad sunrise/sunset by half the daylight span.
  let sunCycleT = 0.25;
  const sunDataReady = !!sunQ.data && !sunQ.isLoading && !sunQ.error;
  if (sunDataReady) {
    const sunriseIso = sunQ.data!.sunriseLocal ?? null;
    const sunsetIso = sunQ.data!.sunsetLocal ?? null;
    if (sunriseIso && sunsetIso) {
      const sunrise = new Date(sunriseIso);
      const sunset = new Date(sunsetIso);
      const span = sunset.getTime() - sunrise.getTime();
      if (span > 0) {
        const pad = span / 2;
        const startSun = sunrise.getTime() - pad;
        const endSun = sunset.getTime() + pad;
        const total = endSun - startSun;
        if (total > 0) {
          sunCycleT = (now.getTime() - startSun) / total;
        }
      }
    }
  }
  sunCycleT = clamp01(sunCycleT);
  const sunDotX = sunCycleT * VIEW_W;
  const sunDotY = yOnCurve(sunCycleT);

  return (
    <div className="my-4 w-full overflow-hidden rounded-2xl aspect-[3/1]">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-full w-full"
      >
        <defs>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0a213f" />
            <stop offset="100%" stopColor="#000" />
          </linearGradient>

          {/* Moon glow */}
          <radialGradient
            id="moon-glow"
            gradientUnits="userSpaceOnUse"
            cx={dotX}
            cy={dotY}
            r={18}
          >
            <stop offset="0%" stopColor="white" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#5c84c4" stopOpacity="0" />
          </radialGradient>

          {/* Sun glow (conditionally included) */}
          {sunDataReady ? (
            <radialGradient
              id="sun-glow"
              gradientUnits="userSpaceOnUse"
              cx={sunDotX}
              cy={sunDotY}
              r={18}
            >
              <stop offset="0%" stopColor="#fde047" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
            </radialGradient>
          ) : null}

          {/* Clip path to keep glow above the horizon */}
          <clipPath id="above-horizon">
            <rect x="0" y="0" width={VIEW_W} height={HORIZON_Y} />
          </clipPath>
        </defs>

        {/* Background */}
        <rect width={VIEW_W} height={VIEW_H} fill="url(#sky)" />

        {/* Below-horizon area */}
        <rect
          x="0"
          y={HORIZON_Y}
          width={VIEW_W}
          height={VIEW_H - HORIZON_Y}
          fill="#000"
        />

        {/* Moon glow (clipped to above horizon) */}
        <rect
          width={VIEW_W}
          height={VIEW_H}
          fill="url(#moon-glow)"
          clipPath="url(#above-horizon)"
        />

        {/* Sun glow (if ready) */}
        {sunDataReady ? (
          <rect
            width={VIEW_W}
            height={VIEW_H}
            fill="url(#sun-glow)"
            clipPath="url(#above-horizon)"
          />
        ) : null}

        {/* Horizon line */}
        <line
          x1="0"
          y1={HORIZON_Y}
          x2={VIEW_W}
          y2={HORIZON_Y}
          stroke="#6b7280"
          strokeWidth="0.6"
          vectorEffect="non-scaling-stroke"
        />

        {/* Altitude curve */}
        <path
          d={CURVE_PATH}
          stroke="#9ca3af"
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
          fill="none"
        />

        {/* Moon dot */}
        <circle cx={dotX} cy={dotY} r="2.5" fill="#fff" />
        {/* Sun dot (conditionally displayed) */}
        {sunDataReady ? (
          <circle cx={sunDotX} cy={sunDotY} r="2" fill="#fde047" />
        ) : null}
      </svg>
    </div>
  );
}
