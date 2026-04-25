"use client";

import { useEffect, useMemo, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";

import { useMoonPhaseWindow } from "../hooks/useAstronomy";
import {
  DashboardPanelState,
  DashboardSkeletonBlock,
  DashboardStatusBanner,
} from "./DashboardState";
import { MoonPhaseCircle } from "./MoonPhaseCircle";
import {
  DASHBOARD_META_FOOTER_CLASS,
  DASHBOARD_METRIC_LABEL_CLASS,
  DASHBOARD_PANEL_CLASS,
  DASHBOARD_PANEL_EYEBROW_CLASS,
  DASHBOARD_PANEL_HEADER_CLASS,
  DASHBOARD_PANEL_TITLE_CLASS,
  DASHBOARD_SUPPORT_TEXT_CLASS,
  DASHBOARD_SURFACE_CLASS,
} from "./moonDashboardShared";

const WINDOW_DAYS = 35;

function formatPhaseDate(iso: string, tz: string) {
  return formatInTimeZone(new Date(iso), tz, "EEE, MMM d");
}

function formatPhaseTime(iso: string, tz: string) {
  return formatInTimeZone(new Date(iso), tz, "h:mm a");
}

export default function MoonCalendarPreview({
  tz,
  title = "Next lunar events",
}: {
  tz: string;
  title?: string;
}) {
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

  const phaseWindowQ = useMoonPhaseWindow(tz, todayDateIso, WINDOW_DAYS);

  if (phaseWindowQ.isLoading && !phaseWindowQ.data) {
    return (
      <div className={`${DASHBOARD_PANEL_CLASS} min-h-[16rem]`}>
        <div className={DASHBOARD_PANEL_HEADER_CLASS}>
          <div className="space-y-2">
            <DashboardSkeletonBlock className="h-2 w-28 rounded-full" />
            <DashboardSkeletonBlock className="h-4 w-36" />
          </div>
          <DashboardSkeletonBlock className="h-8 w-28 rounded-full" />
        </div>

        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <DashboardSkeletonBlock
              key={`calendar-preview-skeleton-${index}`}
              className="h-[4.25rem] rounded-xl"
            />
          ))}
        </div>

        <DashboardStatusBanner>
          Loading the phase window. This can take a moment.
        </DashboardStatusBanner>
      </div>
    );
  }

  if (phaseWindowQ.error && !phaseWindowQ.data) {
    return (
      <DashboardPanelState
        title="Calendar preview unavailable"
        body="The upcoming phase preview could not be loaded right now."
        tone="danger"
        minHeightClass="min-h-[16rem]"
      />
    );
  }

  if (!phaseWindowQ.data) {
    return (
      <DashboardPanelState
        title="Calendar preview unavailable"
        body="The upcoming phase preview is still waiting for phase data."
        minHeightClass="min-h-[16rem]"
      />
    );
  }

  const upcomingPhases = phaseWindowQ.data.days
    .flatMap((day) =>
      day.phases.map((phase) => ({
        ...phase,
        dateLocal: day.date_local,
        isToday: day.is_today,
      })),
    )
    .slice(0, 3);

  const status =
    phaseWindowQ.error
      ? {
          tone: "warning" as const,
          message: "Phase refresh failed. Showing the last preview.",
        }
      : phaseWindowQ.isFetching
        ? {
            tone: "neutral" as const,
            message: "Updating the phase preview...",
          }
        : null;

  return (
    <div className={`${DASHBOARD_PANEL_CLASS} min-h-[16rem]`}>
      <header className={`${DASHBOARD_PANEL_HEADER_CLASS} flex-wrap`}>
        <div className="min-w-0">
          <p className={DASHBOARD_PANEL_EYEBROW_CLASS}>Lunar events</p>
          <h2 className={DASHBOARD_PANEL_TITLE_CLASS}>{title}</h2>
        </div>
      </header>

      {status ? (
        <DashboardStatusBanner tone={status.tone}>
          {status.message}
        </DashboardStatusBanner>
      ) : null}

      {upcomingPhases.length > 0 ? (
        <section className="space-y-2">
          {upcomingPhases.map((phase) => (
            <div
              key={`${phase.key}-${phase.instant_utc}`}
              className={`${DASHBOARD_SURFACE_CLASS} flex items-start gap-3`}
            >
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-950/60">
                <MoonPhaseCircle
                  size={18}
                  illuminationFrac={phase.illumination_frac}
                  waxing={phase.waxing}
                  phaseAngleDeg={phase.phase_angle_deg}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <div className="text-sm font-semibold text-slate-50">{phase.label}</div>
                  {phase.isToday ? (
                    <span className="rounded-full border border-sky-300/18 bg-sky-300/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-sky-100/78">
                      Today
                    </span>
                  ) : null}
                </div>
                <div className={`mt-1 ${DASHBOARD_METRIC_LABEL_CLASS}`}>
                  {formatPhaseDate(phase.instant_local, tz)}
                </div>
                <div className="mt-0.5 text-[12px] font-medium text-slate-100">
                  {formatPhaseTime(phase.instant_local, tz)}
                </div>
              </div>
            </div>
          ))}
        </section>
      ) : (
        <div className={`${DASHBOARD_SURFACE_CLASS} text-sm text-slate-300/72`}>
          No major phases are scheduled in the current preview window.
        </div>
      )}

      <footer className={DASHBOARD_META_FOOTER_CLASS}>
        Previewing the next major phases in the 35-day calendar window.
      </footer>
    </div>
  );
}
