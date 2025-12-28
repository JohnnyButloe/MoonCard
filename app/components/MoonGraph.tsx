// app/components/MoonGraph.tsx
"use client";

import { useLunarNow, useMoonToday } from "../hooks/useLunar";

// SVG coordinates space (wide + short)
const VIEW_W = 100;
const VIEW_H = 40;

// Horizon runs through the grpah
const HORIZON_Y = 24;

// Curve amplitude (peak above horizon, trough below horizon)
const AMP = 14;

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

// Full “day/night” sine curve:
// t=0   -> below horizon
// t=0.25-> horizon (rise)
// t=0.5 -> peak (high moon)
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
    const y = yOnCurve(t); // ✅ SAME function used by the dot
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

  // ✅ Early returns AFTER hooks are called
  const ready =
    !!nowQ.data &&
    !!todayQ.data &&
    !nowQ.isLoading &&
    !todayQ.isLoading &&
    !nowQ.error &&
    !todayQ.error;

  if (!ready) return null;

  const nowIso = nowQ.data!.whenISO;
  const riseIso = todayQ.data!.internal.rise ?? todayQ.data!.external.rise;
  const setIso = todayQ.data!.internal.set ?? todayQ.data!.external.set;

  const now = new Date(nowIso);
  const rise = riseIso ? new Date(riseIso) : null;
  const set = setIso ? new Date(setIso) : null;

  // Map time to curve position so that:
  // - rise appears around 25% across the curve
  // - set appears around 75% across the curve
  // We do this by giving "padding" time before rise and after set = half the above-horizon span.
  let cycleT = 0.25; // default: left horizon point
  if (rise && set) {
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

  const dotX = cycleT * VIEW_W;
  const dotY = yOnCurve(cycleT);

  // For the glow to track the dot without weird bounding-box math
  const glowId = "moon-glow";

  return (
    // Use a real aspect ratio box so the SVG isn't squished by layout.
    // Tailwind supports arbitrary aspect ratios like aspect-[3/1]. :contentReference[oaicite:2]{index=2}
    <div className="my-4 w-full overflow-hidden rounded-2xl aspect-[3/1]">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        // IMPORTANT: do NOT use "none" or the curve will distort. :contentReference[oaicite:3]{index=3}
        preserveAspectRatio="xMidYMid meet"
        className="block h-full w-full"
      >
        <defs>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0a213f" />
            <stop offset="100%" stopColor="#000" />
          </linearGradient>

          <radialGradient
            id={glowId}
            gradientUnits="userSpaceOnUse"
            cx={dotX}
            cy={dotY}
            r={18}
          >
            <stop offset="0%" stopColor="white" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#5c84c4" stopOpacity="0" />
          </radialGradient>

          {/* Optional: keep glow above the horizon only */}
          <clipPath id="above-horizon">
            <rect x="0" y="0" width={VIEW_W} height={HORIZON_Y} />
          </clipPath>
        </defs>

        {/* Background */}
        <rect width={VIEW_W} height={VIEW_H} fill="url(#sky)" />

        {/* Below-horizon area is solid black (like your example) */}
        <rect
          x="0"
          y={HORIZON_Y}
          width={VIEW_W}
          height={VIEW_H - HORIZON_Y}
          fill="#000"
        />

        {/* Glow (clipped above horizon to match your reference) */}
        <rect
          width={VIEW_W}
          height={VIEW_H}
          fill={`url(#${glowId})`}
          clipPath="url(#above-horizon)"
        />

        {/* Horizon line THROUGH the graph */}
        <line
          x1="0"
          y1={HORIZON_Y}
          x2={VIEW_W}
          y2={HORIZON_Y}
          stroke="#6b7280"
          strokeWidth="0.6"
          vectorEffect="non-scaling-stroke"
        />

        {/* Altitude curve (includes below-horizon ends) */}
        <path
          d={CURVE_PATH}
          stroke="#9ca3af"
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
          fill="none"
        />

        {/* Moon dot */}
        <circle cx={dotX} cy={dotY} r="2.5" fill="#fff" />
      </svg>
    </div>
  );
}
