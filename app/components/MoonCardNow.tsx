"use client";

import { useMoonCard } from "../hooks/useAstronomy";
import {
  DashboardPanelState,
  DashboardSkeletonBlock,
  DashboardStatusBanner,
} from "./DashboardState";
import { MoonPhaseCircle } from "./MoonPhaseCircle";
import {
  formatAzimuthWithDirection,
  formatDegrees,
  formatLocalTime,
  formatPercent,
} from "./moonDashboardShared";

export default function MoonNowCard({
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

  if (summaryQ.error && !summaryQ.data) {
    return (
      <DashboardPanelState
        title="Moon data unavailable"
        body="The astronomy service did not respond. Try refreshing in a moment."
        tone="danger"
      />
    );
  }

  if (!summaryQ.data) {
    return (
      <div className="flex h-full w-full min-h-[21rem] flex-col gap-3 rounded-[1.5rem] bg-slate-950/70 p-4 shadow-lg shadow-black/25 ring-1 ring-white/10 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <DashboardSkeletonBlock className="h-2 w-24 rounded-full" />
            <DashboardSkeletonBlock className="h-4 w-28" />
            <DashboardSkeletonBlock className="h-3 w-40" />
          </div>
          <DashboardSkeletonBlock className="h-11 w-24 rounded-xl" />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <DashboardSkeletonBlock className="h-[4.8rem] rounded-xl" />
          <DashboardSkeletonBlock className="h-[4.8rem] rounded-xl" />
          <DashboardSkeletonBlock className="h-[4.8rem] rounded-xl sm:block hidden" />
        </div>

        <DashboardSkeletonBlock className="h-[4.6rem] rounded-xl" />

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <DashboardSkeletonBlock
              key={`moon-now-skeleton-${index}`}
              className="h-[4.4rem] rounded-xl"
            />
          ))}
        </div>

        <DashboardSkeletonBlock className="mt-auto h-3 w-44 rounded-full" />

        <DashboardStatusBanner>
          Loading moon data. This can take a moment.
        </DashboardStatusBanner>
      </div>
    );
  }

  const summary = summaryQ.data;
  const moon = summary.moon;
  const missingPrimaryFieldCount = [
    moon.phase_name,
    moon.illumination_percent,
    moon.altitude_deg,
    moon.azimuth_deg,
  ].filter((value) => value === null || value === undefined).length;
  const hasPartialMoonSummary = missingPrimaryFieldCount > 0;
  const hasCanonicalSummaryIssues = summary.errors.length > 0;
  const astronomyStatus =
    summaryQ.error
      ? {
          tone: "warning" as const,
          message: "Astronomy refresh failed. Showing the last update.",
        }
      : hasCanonicalSummaryIssues
        ? {
            tone: "warning" as const,
            message: "Astronomy data is degraded. Some details may be limited.",
          }
          : hasPartialMoonSummary
            ? {
                tone: "neutral" as const,
                message: "Some lunar details are unavailable right now.",
              }
            : null;
  const lastUpdatedLabel =
    summaryQ.dataUpdatedAt > 0
      ? formatLocalTime(new Date(summaryQ.dataUpdatedAt).toISOString(), tz)
      : "—";
  const horizonState =
    moon.is_up === true
      ? {
          label: "Above horizon",
          className:
            "border-emerald-300/22 bg-emerald-300/10 text-emerald-100/90",
          detail: "Currently visible over the horizon.",
        }
      : moon.is_up === false
        ? {
            label: "Below horizon",
            className: "border-white/10 bg-white/[0.04] text-slate-200/82",
            detail: "Currently below the horizon.",
          }
        : {
            label: "Position pending",
            className: "border-white/10 bg-white/[0.04] text-slate-200/82",
            detail: "Horizon state is temporarily unavailable.",
          };
  const visibilitySummary =
    summary.visibility.summary ??
    (moon.is_up
      ? "Use the altitude timeline below to see how the Moon tracks through the day."
      : "Check the timeline below for the next part of the Moon's visible arc.");

  return (
    <div className="flex h-full min-h-[23rem] w-full flex-col gap-4 rounded-[1.75rem] bg-slate-950/75 p-5 shadow-lg shadow-black/25 ring-1 ring-white/10 backdrop-blur sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
        <div className="min-w-0 space-y-0.5">
          <p className="text-[10px] uppercase tracking-[0.26em] text-sky-200/52">
            Current snapshot
          </p>
          <h2 className="text-base font-semibold tracking-tight text-slate-50 sm:text-[1.05rem]">
            Moon now
          </h2>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${horizonState.className}`}
        >
          {horizonState.label}
        </span>
      </header>

      {astronomyStatus ? (
        <DashboardStatusBanner tone={astronomyStatus.tone}>
          {astronomyStatus.message}
        </DashboardStatusBanner>
      ) : null}

      <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(15rem,0.8fr)]">
        <section className="flex min-h-0 flex-col justify-between rounded-[1.4rem] border border-sky-200/10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_rgba(15,23,42,0.58)_42%,_rgba(2,6,23,0.92)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-950/60 shadow-[0_12px_32px_rgba(2,6,23,0.38)]">
              <MoonPhaseCircle
                illuminationFrac={moon.illumination_fraction ?? undefined}
                phaseAngleDeg={moon.phase_angle_deg ?? undefined}
                size={68}
              />
            </div>

            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-sky-100/62">
                Current phase
              </div>
              <div className="mt-1 text-[1.5rem] font-semibold leading-tight text-slate-50 sm:text-[1.85rem]">
                {moon.phase_name ?? "—"}
              </div>
              <div className="mt-2 text-sm text-slate-200/82">
                <span className="text-[1.15rem] font-semibold text-white">
                  {formatPercent(moon.illumination_percent)}
                </span>{" "}
                illuminated
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-sky-100/60">
                Visibility now
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-50">
                {horizonState.label}
              </div>
              <div className="mt-1 text-[11px] leading-relaxed text-slate-300/72">
                {horizonState.detail}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-sky-100/60">
                Viewing note
              </div>
              <div className="mt-1 text-[11px] leading-relaxed text-slate-200/78">
                {visibilitySummary}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-1">
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-300/60">
              Illumination
            </div>
            <div className="mt-1 text-[1.7rem] font-semibold leading-none text-slate-50">
              {formatPercent(moon.illumination_percent)}
            </div>
          </div>

          <div className="relative rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3">
            <div className="group/metric inline-flex w-full flex-col" tabIndex={0}>
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-300/60">
                Altitude
              </div>
              <div className="mt-1 text-[1.4rem] font-semibold leading-tight text-slate-50">
                {formatDegrees(moon.altitude_deg)}
              </div>
              <div className="mt-1 text-[11px] text-slate-300/68">
                Relative to your horizon
              </div>
              <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-white/10 bg-slate-950/90 p-3 text-xs text-slate-100 opacity-0 shadow-lg shadow-black/40 backdrop-blur transition group-hover/metric:opacity-100 group-focus-within/metric:opacity-100">
                Altitude relative to the horizon (0° = on the horizon, positive =
                above, negative = below).
              </div>
            </div>
          </div>

          <div className="relative rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3">
            <div className="group/metric inline-flex w-full flex-col" tabIndex={0}>
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-300/60">
                Azimuth
              </div>
              <div className="mt-1 text-base font-semibold leading-snug text-slate-50">
                {formatAzimuthWithDirection(moon.azimuth_deg)}
              </div>
              <div className="mt-1 text-[11px] text-slate-300/68">
                Compass direction on the horizon
              </div>
              <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-white/10 bg-slate-950/90 p-3 text-xs text-slate-100 opacity-0 shadow-lg shadow-black/40 backdrop-blur transition group-hover/metric:opacity-100 group-focus-within/metric:opacity-100">
                Azimuth is the Moon&apos;s compass direction along the horizon,
                measured in degrees from true north (0°), moving eastward (90°),
                south (180°), and west (270°).
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-white/8 pt-2 text-[10px] text-slate-400/72">
        <div>Source: {summary.meta.calculation_source}</div>
        <div>
          Updated {lastUpdatedLabel}
          {summaryQ.isFetching ? " · updating" : ""}
        </div>
      </footer>
    </div>
  );
}
