"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { useMoonPhaseWindow } from "../hooks/useAstronomy";
import { MoonPhaseCircle } from "./MoonPhaseCircle";

const WINDOW_DAYS = 35;

function formatRangeDate(dateIso: string, tz: string) {
  return formatInTimeZone(fromZonedTime(`${dateIso}T12:00:00`, tz), tz, "MMM d");
}

export default function MoonPhaseCalendar({ tz }: { tz: string }) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedPhaseKey, setSelectedPhaseKey] = useState<string | null>(null);

  const startDateIso = useMemo(() => {
    const todayIso = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
    const todayAnchor = fromZonedTime(`${todayIso}T12:00:00`, tz);
    return formatInTimeZone(addDays(todayAnchor, weekOffset * 7), tz, "yyyy-MM-dd");
  }, [tz, weekOffset]);

  const phaseWindowQ = useMoonPhaseWindow(tz, startDateIso, WINDOW_DAYS);

  useEffect(() => {
    if (!selectedPhaseKey) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      setSelectedPhaseKey(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedPhaseKey(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedPhaseKey]);

  if (phaseWindowQ.isLoading && !phaseWindowQ.data) {
    return (
      <section ref={rootRef} className="flex min-h-0 flex-1 flex-col">
        <div className="text-sm text-slate-300/70">Loading calendar…</div>
      </section>
    );
  }

  if (phaseWindowQ.error || !phaseWindowQ.data) {
    return (
      <section ref={rootRef} className="flex min-h-0 flex-1 flex-col">
        <div className="text-sm text-slate-300/70">Calendar unavailable.</div>
      </section>
    );
  }

  const { days, meta } = phaseWindowQ.data;
  const dayLabels = days.slice(0, 7).map((day) => day.weekday_short);
  const rangeLabel = `${formatRangeDate(meta.window_start_local_date, tz)} - ${formatRangeDate(meta.window_end_local_date, tz)}`;

  return (
    <section ref={rootRef} className="flex min-h-0 flex-1 flex-col">
      <div className="mb-1.5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs uppercase tracking-[0.3em] text-sky-200/60">
            Moon calendar
          </h3>
          <p className="mt-1 text-[13px] text-slate-200/78">Major phases</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedPhaseKey(null);
              setWeekOffset((current) => Math.max(0, current - 1));
            }}
            disabled={weekOffset === 0}
            aria-label="View previous week window"
            className={`flex h-7 w-7 items-center justify-center rounded-full border text-sm transition ${
              weekOffset === 0
                ? "cursor-not-allowed border-white/8 text-slate-500/50"
                : "border-white/10 text-slate-200/85 hover:border-white/20 hover:text-white"
            }`}
          >
            &lt;
          </button>
          <p className="min-w-[8.5rem] text-center text-[11px] uppercase tracking-[0.18em] text-slate-300/65">
            {rangeLabel}
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedPhaseKey(null);
              setWeekOffset((current) => current + 1);
            }}
            aria-label="View next week window"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-sm text-slate-200/85 transition hover:border-white/20 hover:text-white"
          >
            &gt;
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-[0.2em] text-slate-400/80">
        {dayLabels.map((label, index) => (
          <div key={`${label}-${index}`} className="px-1">
            {label}
          </div>
        ))}
      </div>

      <div className="mt-1.5 grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          const dayNumber = String(Number(day.date_local.slice(-2)));
          const isPast = day.date_local < meta.today_local_date;
          const primaryEntry = day.phases[0];
          const entryKey = primaryEntry
            ? `${primaryEntry.key}-${primaryEntry.instant_utc}`
            : null;
          const isSelected = entryKey !== null && selectedPhaseKey === entryKey;
          const rowIndex = Math.floor(index / 7);
          const popupPlacement =
            rowIndex <= 1 ? "top-[calc(100%+0.45rem)]" : "bottom-[calc(100%+0.45rem)]";
          const pointerPlacement =
            rowIndex <= 1
              ? "top-[-0.4rem] border-b border-r"
              : "bottom-[-0.4rem] border-t border-l";

          return (
            <div
              key={day.date_local}
              className={`relative flex h-[3.05rem] flex-col rounded-xl border px-1.5 py-1 transition ${
                primaryEntry
                  ? "border-sky-300/35 bg-sky-400/10 shadow-[0_0_0_1px_rgba(125,211,252,0.05)]"
                  : "border-white/8 bg-slate-950/35"
              } ${day.is_today ? "ring-1 ring-sky-300/55" : ""} ${isPast ? "opacity-55" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold leading-none text-slate-100">
                  {dayNumber}
                </div>
              </div>

              {primaryEntry ? (
                <button
                  type="button"
                  className={`mt-0.5 flex min-h-0 flex-1 items-center justify-center rounded-md transition hover:bg-white/8 focus:outline-none focus:ring-1 focus:ring-sky-300/60 ${
                    isSelected ? "bg-white/8" : ""
                  }`}
                  onClick={() => {
                    setSelectedPhaseKey((current) =>
                      current === entryKey ? null : entryKey,
                    );
                  }}
                  aria-label={`${primaryEntry.label} on ${formatInTimeZone(new Date(primaryEntry.instant_local), tz, "MMMM d")} at ${formatInTimeZone(new Date(primaryEntry.instant_local), tz, "h:mm a")}`}
                >
                  <MoonPhaseCircle
                    className="shrink-0"
                    size={14}
                    illuminationFrac={primaryEntry.illumination_frac}
                    waxing={primaryEntry.waxing}
                    phaseAngleDeg={primaryEntry.phase_angle_deg}
                  />
                </button>
              ) : (
                <div className="mt-0.5 flex-1" />
              )}

              {primaryEntry && isSelected ? (
                <div
                  className={`pointer-events-none absolute left-1/2 z-30 w-max min-w-[9rem] max-w-[10rem] -translate-x-1/2 rounded-xl border border-sky-200/20 bg-slate-950/98 px-3 py-2 text-center shadow-[0_18px_40px_rgba(2,6,23,0.72)] ring-1 ring-sky-300/18 backdrop-blur-md ${popupPlacement}`}
                >
                  <div
                    className={`absolute left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-sky-200/20 bg-slate-950/98 ${pointerPlacement}`}
                  />
                  <div className="text-[10px] uppercase tracking-[0.18em] text-sky-100/72">
                    {primaryEntry.label}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {formatInTimeZone(new Date(primaryEntry.instant_local), tz, "h:mm a")}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-300/65">
                    Click anywhere to close
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
