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
  formatTimeOrDateTime,
} from "./moonDashboardShared";

function toEventMs(value: string | null | undefined): number | null {
  if (!value) return null;

  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function getKeyEvent({
  moon,
  nowIso,
  tz,
}: {
  moon: {
    moonrise: string | null;
    moonset: string | null;
    high_moon: string | null;
  };
  nowIso: string;
  tz: string;
}) {
  const nowMs = toEventMs(nowIso) ?? Date.now();
  const candidates = [
    {
      label: "Moonrise",
      iso: moon.moonrise,
      detail: "Moon clears the horizon.",
    },
    {
      label: "Peak altitude",
      iso: moon.high_moon,
      detail: "Highest point in the sky.",
    },
    {
      label: "Moonset",
      iso: moon.moonset,
      detail: "Moon drops below the horizon.",
    },
  ]
    .map((event) => ({
      ...event,
      ms: toEventMs(event.iso),
    }))
    .filter(
      (
        event,
      ): event is {
        label: string;
        iso: string;
        detail: string;
        ms: number;
      } => event.iso !== null && event.ms !== null,
    );

  const nextEvent = candidates
    .filter((event) => event.ms >= nowMs)
    .sort((a, b) => a.ms - b.ms)[0];

  if (nextEvent) {
    return {
      heading: "Next key event",
      label: nextEvent.label,
      value: formatTimeOrDateTime(nextEvent.iso, tz),
      detail: nextEvent.detail,
      accentClass: "border-sky-300/18 bg-sky-400/8",
    };
  }

  const lastEvent = [...candidates].sort((a, b) => b.ms - a.ms)[0];

  if (lastEvent) {
    return {
      heading: "Latest key event",
      label: lastEvent.label,
      value: formatTimeOrDateTime(lastEvent.iso, tz),
      detail: "No later key event is available today.",
      accentClass: "border-white/10 bg-white/[0.04]",
    };
  }

  return {
    heading: "Key event",
    label: "Unavailable",
    value: "—",
    detail: "Event timing is temporarily unavailable.",
    accentClass: "border-white/10 bg-white/[0.04]",
  };
}

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
      <div className="flex h-full w-full min-h-[18rem] flex-col gap-3 rounded-[1.5rem] bg-slate-950/75 p-4 shadow-lg shadow-black/25 ring-1 ring-white/10 backdrop-blur sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <DashboardSkeletonBlock className="h-2 w-24 rounded-full" />
            <DashboardSkeletonBlock className="h-4 w-28" />
          </div>
          <DashboardSkeletonBlock className="h-7 w-24 rounded-full" />
        </div>

        <DashboardSkeletonBlock className="h-[7.2rem] rounded-[1.25rem]" />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <DashboardSkeletonBlock
              key={`moon-now-skeleton-${index}`}
              className="h-[4.8rem] rounded-xl"
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
  const visibilityState =
    moon.is_up === true
      ? {
          badge: "Visible now",
          label: "Above horizon",
          detail: "Currently visible over the horizon.",
          badgeClass:
            "border-emerald-300/22 bg-emerald-300/10 text-emerald-100/90",
          dotClass: "bg-emerald-200",
        }
      : moon.is_up === false
        ? {
            badge: "Below horizon",
            label: "Below horizon",
            detail: "Currently below the horizon.",
            badgeClass: "border-white/10 bg-white/[0.04] text-slate-200/82",
            dotClass: "bg-slate-300/75",
          }
        : {
            badge: "Status pending",
            label: "Position pending",
            detail: "Horizon state is temporarily unavailable.",
            badgeClass: "border-white/10 bg-white/[0.04] text-slate-200/82",
            dotClass: "bg-slate-300/75",
          };
  const keyEvent = getKeyEvent({
    moon,
    nowIso: summary.meta.timestamp_iso,
    tz,
  });

  return (
    <div className="flex h-full min-h-[18rem] w-full flex-col gap-3 rounded-[1.6rem] bg-slate-950/80 p-4 shadow-lg shadow-black/25 ring-1 ring-white/10 backdrop-blur sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-[10px] uppercase tracking-[0.26em] text-sky-200/52">
            Current snapshot
          </p>
          <h2 className="text-base font-semibold tracking-tight text-slate-50 sm:text-[1.05rem]">
            Moon now
          </h2>
        </div>
      </header>

      {astronomyStatus ? (
        <DashboardStatusBanner tone={astronomyStatus.tone}>
          {astronomyStatus.message}
        </DashboardStatusBanner>
      ) : null}

      <section className="rounded-[1.35rem] border border-sky-200/10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_rgba(15,23,42,0.58)_40%,_rgba(2,6,23,0.92)_100%)] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-950/65 shadow-[0_8px_24px_rgba(2,6,23,0.34)]">
              <MoonPhaseCircle
                illuminationFrac={moon.illumination_fraction ?? undefined}
                phaseAngleDeg={moon.phase_angle_deg ?? undefined}
                size={52}
              />
            </div>

            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-sky-100/62">
                Current phase
              </div>
              <div className="mt-1 text-[1.35rem] font-semibold leading-tight text-slate-50 sm:text-[1.55rem]">
                {moon.phase_name ?? "—"}
              </div>
              <div className="mt-1.5 text-sm text-slate-200/82">
                <span className="text-[1.05rem] font-semibold text-white">
                  {formatPercent(moon.illumination_percent)}
                </span>{" "}
                illuminated
              </div>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${visibilityState.badgeClass}`}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${visibilityState.dotClass}`}
            />
            {visibilityState.badge}
          </span>
        </div>

        <div
          className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${keyEvent.accentClass}`}
        >
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-sky-100/60">
              {keyEvent.heading}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-50">
              {keyEvent.label}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold leading-none text-slate-50">
              {keyEvent.value}
            </div>
            <div className="mt-1 text-[11px] text-slate-300/70">
              {keyEvent.detail}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-300/60">
            Illumination
          </div>
          <div className="mt-1 text-[1.35rem] font-semibold leading-none text-slate-50">
            {formatPercent(moon.illumination_percent)}
          </div>
          <div className="mt-1 text-[11px] text-slate-300/68">Moonlight</div>
        </div>

        <div className="relative rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
          <div className="group/metric inline-flex w-full flex-col" tabIndex={0}>
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-300/60">
              Altitude
            </div>
            <div className="mt-1 text-[1.2rem] font-semibold leading-tight text-slate-50">
              {formatDegrees(moon.altitude_deg)}
            </div>
            <div className="mt-1 text-[11px] text-slate-300/68">Relative to horizon</div>
            <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-white/10 bg-slate-950/90 p-3 text-xs text-slate-100 opacity-0 shadow-lg shadow-black/40 backdrop-blur transition group-hover/metric:opacity-100 group-focus-within/metric:opacity-100">
              Altitude relative to the horizon (0° = on the horizon, positive =
              above, negative = below).
            </div>
          </div>
        </div>

        <div className="relative rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
          <div className="group/metric inline-flex w-full flex-col" tabIndex={0}>
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-300/60">
              Azimuth
            </div>
            <div className="mt-1 text-[0.98rem] font-semibold leading-snug text-slate-50">
              {formatAzimuthWithDirection(moon.azimuth_deg)}
            </div>
            <div className="mt-1 text-[11px] text-slate-300/68">Compass bearing</div>
            <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-white/10 bg-slate-950/90 p-3 text-xs text-slate-100 opacity-0 shadow-lg shadow-black/40 backdrop-blur transition group-hover/metric:opacity-100 group-focus-within/metric:opacity-100">
              Azimuth is the Moon&apos;s compass direction along the horizon,
              measured in degrees from true north (0°), moving eastward (90°),
              south (180°), and west (270°).
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-300/60">
            Visible now
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-50">
            {visibilityState.label}
          </div>
          <div className="mt-1 text-[11px] text-slate-300/68">
            {visibilityState.detail}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/8 pt-2 text-[10px] text-slate-400/70">
        <div className="text-slate-400/68">
          {summary.visibility.summary ?? "Live lunar snapshot"}
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div>Source: {summary.meta.calculation_source}</div>
          <div>
            Updated {lastUpdatedLabel}
            {summaryQ.isFetching ? " · updating" : ""}
          </div>
        </div>
      </footer>
    </div>
  );
}
