// app/components/TwilightPhaseBar.tsx
"use client";

import { useTwilight } from "../hooks/useTwilight";
import { formatInTimeZone } from "date-fns-tz";

const PHASE_COLORS: Record<string, string> = {
  dark: "bg-slate-950",
  astronomical: "bg-indigo-950",
  nautical: "bg-blue-950",
  civil: "bg-blue-700",
  day: "bg-sky-300",
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
      <div className="my-4 p-4 rounded-2xl bg-white/5 backdrop-blur">
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
      <div className="my-4 p-4 rounded-2xl bg-white/5 backdrop-blur text-xs opacity-70 text-center">
        Twilight unavailable (check /api/py-twilight in Network tab)
      </div>
    );
  }

  const { segments, currentPhase, nextTransitionLocal } = q.data;
  if (!segments?.length) return null;

  const startLocal = new Date(segments[0].startLocal);
  const endLocal = new Date(segments[segments.length - 1].endLocal);
  const totalMs = endLocal.getTime() - startLocal.getTime();

  const now = new Date();
  const pos = Math.max(
    0,
    Math.min(1, (now.getTime() - startLocal.getTime()) / (totalMs || 1))
  );

  return (
    <div className="my-4 p-4 rounded-2xl bg-white/5 backdrop-blur relative z-10">
      <div className="relative w-full h-3 flex rounded-full overflow-hidden">
        {segments.map((seg, idx) => {
          const segStart = new Date(seg.startLocal);
          const segEnd = new Date(seg.endLocal);
          const widthPct =
            ((segEnd.getTime() - segStart.getTime()) / totalMs) * 100;
          const cls = PHASE_COLORS[seg.phase] || "bg-gray-600";

          return (
            <div
              key={idx}
              className={`${cls} h-full`}
              style={{ width: `${widthPct}%` }}
            />
          );
        })}

        {/* Current time marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white"
          style={{ left: `${pos * 100}%` }}
        />
      </div>

      <div className="text-xs text-center mt-2">
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
  );
}
