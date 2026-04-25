"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { useMoonPhaseWindow } from "../hooks/useAstronomy";
import {
  DashboardPanelState,
  DashboardSkeletonBlock,
  DashboardStatusBanner,
} from "./DashboardState";
import { MoonPhaseCircle } from "./MoonPhaseCircle";

const WINDOW_DAYS = 35;

function formatRangeDate(dateIso: string, tz: string) {
  return formatInTimeZone(fromZonedTime(`${dateIso}T12:00:00`, tz), tz, "MMM d");
}

export default function MoonPhaseCalendar({
  tz,
  compact = false,
}: {
  tz: string;
  compact?: boolean;
}) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedPhaseKey, setSelectedPhaseKey] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [tz]);

  const todayDateIso = useMemo(
    () => formatInTimeZone(new Date(clockNow), tz, "yyyy-MM-dd"),
    [clockNow, tz],
  );

  const startDateIso = useMemo(() => {
    const todayAnchor = fromZonedTime(`${todayDateIso}T12:00:00`, tz);
    return formatInTimeZone(addDays(todayAnchor, weekOffset * 7), tz, "yyyy-MM-dd");
  }, [todayDateIso, tz, weekOffset]);

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

  const panelMinHeightClass = compact ? "min-h-[16rem]" : "min-h-[19rem]";
  const dayCellHeightClass = compact ? "h-[2.35rem]" : "h-[2.85rem]";
  const dayCellPaddingClass = compact ? "px-1.25 py-0.75" : "px-1.5 py-1";
  const dayNumberClass = compact
    ? "text-[12px] font-semibold leading-none text-slate-100"
    : "text-[13px] font-semibold leading-none text-slate-100";
  const iconSize = compact ? 10 : 12;
  const gridGapClass = compact ? "gap-[0.35rem]" : "gap-0.5";

  if (phaseWindowQ.isLoading && !phaseWindowQ.data) {
    return (
      <section ref={rootRef} className={`flex ${panelMinHeightClass} flex-1 flex-col gap-2.5`}>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-2">
            <DashboardSkeletonBlock className="h-2 w-24 rounded-full" />
            <DashboardSkeletonBlock className="h-4 w-28" />
          </div>
          <DashboardSkeletonBlock className="h-8 w-32 rounded-full" />
        </div>

        <div className={`grid grid-cols-7 ${gridGapClass}`}>
          {Array.from({ length: 7 }).map((_, index) => (
            <DashboardSkeletonBlock
              key={`calendar-heading-skeleton-${index}`}
              className="h-3 rounded-md"
            />
          ))}
        </div>

        <div className={`grid grid-cols-7 ${gridGapClass}`}>
          {Array.from({ length: 35 }).map((_, index) => (
            <DashboardSkeletonBlock
              key={`calendar-day-skeleton-${index}`}
              className={`${dayCellHeightClass} rounded-lg`}
            />
          ))}
        </div>

        <DashboardStatusBanner>
          Loading the phase window. This can take a moment.
        </DashboardStatusBanner>
      </section>
    );
  }

  if (phaseWindowQ.error && !phaseWindowQ.data) {
    return (
      <section ref={rootRef} className="flex min-h-0 flex-1 flex-col">
        <DashboardPanelState
          title="Phase window unavailable"
          body="The calendar could not load this window."
          tone="danger"
          minHeightClass={panelMinHeightClass}
        />
      </section>
    );
  }

  if (!phaseWindowQ.data) {
    return (
      <section ref={rootRef} className="flex min-h-0 flex-1 flex-col">
        <DashboardPanelState
          title="Phase window unavailable"
          body="The calendar is still waiting for phase data."
          minHeightClass={panelMinHeightClass}
        />
      </section>
    );
  }

  const { days, meta } = phaseWindowQ.data;
  const hasPhaseEntries = days.some((day) => day.phases.length > 0);
  const phaseWindowStatus =
    phaseWindowQ.error
      ? {
          tone: "warning" as const,
          message: "Phase refresh failed. Showing the last window.",
        }
      : phaseWindowQ.isFetching
        ? {
            tone: "neutral" as const,
            message: "Updating the phase window…",
          }
        : null;

  if (!days.length || !hasPhaseEntries) {
    return (
      <section ref={rootRef} className="flex min-h-0 flex-1 flex-col">
        <DashboardPanelState
          title="No phases in this window"
          body="Try another week to load upcoming major phases."
          minHeightClass={panelMinHeightClass}
        />
      </section>
    );
  }

  const dayLabels = days.slice(0, 7).map((day) => day.weekday_short);
  const rangeLabel = `${formatRangeDate(meta.window_start_local_date, tz)} - ${formatRangeDate(meta.window_end_local_date, tz)}`;

  return (
    <section ref={rootRef} className={`flex ${panelMinHeightClass} flex-1 flex-col gap-2.5`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[10px] uppercase tracking-[0.26em] text-sky-200/52">
            Moon calendar
          </h3>
          <p className="mt-1 text-sm font-semibold tracking-tight text-slate-50">
            Major phases
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-1.5 py-1">
          <button
            type="button"
            onClick={() => {
              setSelectedPhaseKey(null);
              setWeekOffset((current) => Math.max(0, current - 1));
            }}
            disabled={weekOffset === 0}
            aria-label="View previous week window"
            className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs transition ${
              weekOffset === 0
                ? "cursor-not-allowed border-white/8 text-slate-500/45"
                : "border-white/10 bg-white/[0.02] text-slate-200/85 hover:border-white/20 hover:text-white"
            }`}
          >
            &lt;
          </button>
          <p className="min-w-[7.25rem] text-center text-[10px] uppercase tracking-[0.15em] text-slate-300/62">
            {rangeLabel}
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedPhaseKey(null);
              setWeekOffset((current) => current + 1);
            }}
            aria-label="View next week window"
            className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-xs text-slate-200/85 transition hover:border-white/20 hover:text-white"
          >
            &gt;
          </button>
        </div>
      </div>

      {phaseWindowStatus ? (
        <DashboardStatusBanner tone={phaseWindowStatus.tone}>
          {phaseWindowStatus.message}
        </DashboardStatusBanner>
      ) : null}

      <div className={`grid grid-cols-7 ${gridGapClass} text-[9px] uppercase tracking-[0.15em] text-slate-400/76`}>
        {dayLabels.map((label, index) => (
          <div key={`${label}-${index}`} className="px-1 text-center">
            {label}
          </div>
        ))}
      </div>

      <div className={`grid grid-cols-7 ${gridGapClass}`}>
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
              className={`relative flex ${dayCellHeightClass} flex-col rounded-lg border ${dayCellPaddingClass} transition ${
                primaryEntry
                  ? "border-sky-300/32 bg-sky-400/8 shadow-[0_0_0_1px_rgba(125,211,252,0.04)]"
                  : "border-white/8 bg-slate-950/30"
              } ${day.is_today ? "ring-1 ring-sky-300/55" : ""} ${isPast ? "opacity-55" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className={dayNumberClass}>
                  {dayNumber}
                </div>
                {day.is_today ? (
                  <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-300/90" />
                ) : null}
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
                    size={iconSize}
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
                  className={`pointer-events-none absolute left-1/2 z-30 w-max min-w-[8rem] max-w-[9rem] -translate-x-1/2 rounded-lg border border-sky-200/20 bg-slate-950/98 px-2.5 py-2 text-center shadow-[0_18px_40px_rgba(2,6,23,0.72)] ring-1 ring-sky-300/18 backdrop-blur-md ${popupPlacement}`}
                >
                  <div
                    className={`absolute left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-sky-200/20 bg-slate-950/98 ${pointerPlacement}`}
                  />
                  <div className="text-[9px] uppercase tracking-[0.16em] text-sky-100/72">
                    {primaryEntry.label}
                  </div>
                  <div className="mt-1 text-[13px] font-semibold text-white">
                    {formatInTimeZone(new Date(primaryEntry.instant_local), tz, "h:mm a")}
                  </div>
                  <div className="mt-1 text-[9px] text-slate-300/65">
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
