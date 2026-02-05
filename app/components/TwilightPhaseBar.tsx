// app/components/TwilightPhaseBar.tsx
"use client";

import { useTwilight } from "../hooks/useTwilight";
import { formatInTimeZone } from "date-fns-tz";

const PHASE_COLORS: Record<string, string> = {
  dark: "bg-[#0a0f1a]",
  astronomical: "bg-[#1a1f63]",
  nautical: "bg-[#1b3f8a]",
  civil: "bg-[#2f83ff]",
  day: "bg-[#ffd79c]",
};

const PHASE_LABELS: Record<string, string> = {
  dark: "Night",
  astronomical: "Astro",
  nautical: "Nautical",
  civil: "Civil",
  day: "Day",
};

const PHASE_WEIGHTS: Record<string, number> = {
  dark: 0.45,
  astronomical: 1.6,
  nautical: 1.35,
  civil: 1.25,
  day: 0.55,
};

export default function TwilightPhaseBar({
  lat,
  lon,
  tz,
}: {
  lat: number;
  lon: number;
  tz: string;
}) {
  const q = useTwilight(lat, lon, tz);

  // ✅ Visible loading state
  if (q.isLoading) {
    return (
      <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 backdrop-blur">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.3em] text-sky-200/60">
            Twilight
          </div>
          <div className="text-[11px] text-sky-100/70">
            Now {formatInTimeZone(new Date(), tz, "h:mm a z")}
          </div>
        </div>
        <div className="h-3 rounded-full bg-white/10 animate-pulse" />
        <div className="mt-2 text-xs opacity-60 text-center">
          Loading twilight…
        </div>
      </div>
    );
  }

  // ✅ Visible error state (so it doesn't silently disappear)
  if (q.error || !q.data) {
    return (
      <div className="rounded-2xl bg-white/5 p-4 text-xs opacity-70 text-center ring-1 ring-white/10 backdrop-blur">
        Twilight unavailable (check /api/py-twilight in Network tab)
      </div>
    );
  }

  const { segments, currentPhase, nextTransitionLocal, sunEvents } = q.data;
  if (!segments?.length) return null;

  const weightedSegments = segments
    .map((seg) => {
      const segStart = new Date(seg.startLocal);
      const segEnd = new Date(seg.endLocal);
      const durationMs = segEnd.getTime() - segStart.getTime();
      const weight = PHASE_WEIGHTS[seg.phase] ?? 1;
      return {
        ...seg,
        segStart,
        segEnd,
        durationMs: Math.max(0, durationMs),
        weight,
      };
    })
    .filter((seg) => seg.durationMs > 0);

  const totalWeightedMs = weightedSegments.reduce(
    (sum, seg) => sum + seg.durationMs * seg.weight,
    0,
  );

  const now = new Date();
  const posForTime = (time: Date | null) => {
    if (!time || !totalWeightedMs) return 0;
    const t = time.getTime();
    if (t <= weightedSegments[0]?.segStart.getTime()) return 0;
    if (t >= weightedSegments[weightedSegments.length - 1]?.segEnd.getTime())
      return 1;

    let acc = 0;
    for (const seg of weightedSegments) {
      const start = seg.segStart.getTime();
      const end = seg.segEnd.getTime();
      if (t >= start && t <= end) {
        const segSpan = end - start || 1;
        const pct = (t - start) / segSpan;
        const segWeighted = seg.durationMs * seg.weight;
        return (acc + pct * segWeighted) / totalWeightedMs;
      }
      acc += seg.durationMs * seg.weight;
    }
    return 0;
  };
  const pos = posForTime(now);

  const sunriseLocal = sunEvents?.sunriseLocal
    ? new Date(sunEvents.sunriseLocal)
    : null;
  const sunsetLocal = sunEvents?.sunsetLocal
    ? new Date(sunEvents.sunsetLocal)
    : null;
  const sunrisePos = sunriseLocal ? posForTime(sunriseLocal) : null;
  const sunsetPos = sunsetLocal ? posForTime(sunsetLocal) : null;

  return (
    <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 backdrop-blur">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.3em] text-sky-200/60">
          Twilight
        </div>
        <div className="text-xs text-sky-100/80">
          <span className="font-semibold capitalize">{currentPhase}</span>
          {nextTransitionLocal ? (
            <>
              {" "}
              · next:{" "}
              {formatInTimeZone(new Date(nextTransitionLocal), tz, "h:mm a z")}
            </>
          ) : null}
        </div>
      </div>

      <div className="relative w-full h-5 flex rounded-full overflow-hidden ring-1 ring-white/10">
        {weightedSegments.map((seg, idx) => {
          const widthPct =
            ((seg.durationMs * seg.weight) / (totalWeightedMs || 1)) * 100;
          const cls = PHASE_COLORS[seg.phase] || "bg-gray-600";

          return (
            <div
              key={idx}
              className={`${cls} h-full border-r border-white/10`}
              style={{ width: `${widthPct}%` }}
            />
          );
        })}

        {/* Current time marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]"
          style={{ left: `${pos * 100}%` }}
        />
        {sunrisePos !== null ? (
          <div
            className="absolute top-0 h-full w-0.5 bg-yellow-200"
            style={{ left: `${sunrisePos * 100}%` }}
            aria-label="Sunrise"
          />
        ) : null}
        {sunsetPos !== null ? (
          <div
            className="absolute top-0 h-full w-0.5 bg-orange-200"
            style={{ left: `${sunsetPos * 100}%` }}
            aria-label="Sunset"
          />
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-sky-100/70">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)]" />
          Now {formatInTimeZone(new Date(), tz, "h:mm a")}
        </div>
        <div className="flex items-center gap-3">
          {sunriseLocal && (
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-yellow-200" />
              Sunrise {formatInTimeZone(sunriseLocal, tz, "h:mm a")}
            </span>
          )}
          {sunsetLocal && (
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange-200" />
              Sunset {formatInTimeZone(sunsetLocal, tz, "h:mm a")}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-sky-100/50">
        {Object.entries(PHASE_LABELS).map(([key, label]) => {
          const color = PHASE_COLORS[key] ?? "bg-gray-600";
          return (
            <div key={key} className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${color}`} />
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
