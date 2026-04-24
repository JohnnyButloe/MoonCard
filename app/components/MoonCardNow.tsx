"use client";

import { useMoonCard } from "../hooks/useAstronomy";
import { useWeatherNow } from "../hooks/useWeather";
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
  formatLocalTime,
  formatTimeOrDateTime,
  weatherLabel,
} from "./moonDashboardShared";

function formatPercent(value: number | null): string {
  return typeof value === "number" ? `${Math.round(value)}%` : "—";
}

function formatDegrees(value: number | null): string {
  return typeof value === "number" ? `${value.toFixed(0)}°` : "—";
}

function toCompass(azDeg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const normalized = ((azDeg % 360) + 360) % 360;
  return dirs[Math.round(normalized / 45) % dirs.length];
}

function formatAzimuthWithDirection(azDeg: number | null): string {
  if (typeof azDeg !== "number") return "—";

  const normalized = Math.round(((azDeg % 360) + 360) % 360);
  return `${toCompass(normalized)} (${normalized}°)`;
}

function toEventMs(iso: string | null | undefined): number | null {
  if (!iso) return null;

  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function getKeyEvent({
  nowIso,
  moonrise,
  highMoon,
  moonset,
  tz,
}: {
  nowIso: string;
  moonrise: string | null;
  highMoon: string | null;
  moonset: string | null;
  tz: string;
}) {
  const nowMs = toEventMs(nowIso) ?? Date.now();
  const events = [
    {
      label: "Moonrise",
      iso: moonrise,
      detail: "Moon clears the horizon.",
    },
    {
      label: "Peak altitude",
      iso: highMoon,
      detail: "Highest point in the sky.",
    },
    {
      label: "Moonset",
      iso: moonset,
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

  const nextEvent = events
    .filter((event) => event.ms >= nowMs)
    .sort((a, b) => a.ms - b.ms)[0];

  if (nextEvent) {
    return {
      heading: "Next key event",
      label: nextEvent.label,
      value: formatTimeOrDateTime(nextEvent.iso, tz),
      detail: nextEvent.detail,
      className: "border-sky-300/16 bg-sky-400/8",
    };
  }

  const lastEvent = [...events].sort((a, b) => b.ms - a.ms)[0];

  if (lastEvent) {
    return {
      heading: "Key event",
      label: lastEvent.label,
      value: formatTimeOrDateTime(lastEvent.iso, tz),
      detail: "No later key event is available today.",
      className: "border-white/10 bg-white/[0.04]",
    };
  }

  return {
    heading: "Key event",
    label: "Unavailable",
    value: "—",
    detail: "Timing is temporarily unavailable.",
    className: "border-white/10 bg-white/[0.04]",
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
  const weatherQ = useWeatherNow(lat, lon);

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
      <div className={`${DASHBOARD_PANEL_CLASS} min-h-[18rem]`}>
        <div className={`${DASHBOARD_PANEL_HEADER_CLASS} flex-wrap`}>
          <div className="space-y-2">
            <DashboardSkeletonBlock className="h-2 w-24 rounded-full" />
            <DashboardSkeletonBlock className="h-4 w-28" />
          </div>
          <DashboardSkeletonBlock className="h-7 w-20 rounded-full" />
        </div>

        <DashboardSkeletonBlock className="h-[7.2rem] rounded-[1.2rem]" />

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
  const weatherCondition = weatherQ.data?.condition;
  const weatherCloudCover = weatherQ.data?.cloudCoverPct;
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
            "border-emerald-300/20 bg-emerald-300/10 text-emerald-100/90",
        }
      : moon.is_up === false
        ? {
            badge: "Below horizon",
            label: "Below horizon",
            detail: "Currently below the horizon.",
            badgeClass: "border-white/10 bg-white/[0.04] text-slate-200/82",
          }
        : {
            badge: "Status pending",
            label: "Position pending",
            detail: "Horizon state is temporarily unavailable.",
            badgeClass: "border-white/10 bg-white/[0.04] text-slate-200/82",
          };
  const keyEvent = getKeyEvent({
    nowIso: summary.meta.timestamp_iso,
    moonrise: moon.moonrise,
    highMoon: moon.high_moon,
    moonset: moon.moonset,
    tz,
  });
  const weatherSummary = weatherCondition
    ? `Weather ${weatherLabel(weatherCondition)}${
        typeof weatherCloudCover === "number"
          ? ` · ${Math.round(weatherCloudCover)}% cloud`
          : ""
      }`
    : weatherQ.error && weatherQ.data
      ? "Weather cached"
      : weatherQ.error
        ? "Weather unavailable"
        : weatherQ.isLoading
          ? "Loading weather"
          : "Weather live";

  return (
    <div className={`${DASHBOARD_PANEL_CLASS} min-h-[18rem]`}>
      <header className={`${DASHBOARD_PANEL_HEADER_CLASS} flex-wrap`}>
        <div className="min-w-0 space-y-0.5">
          <p className={DASHBOARD_PANEL_EYEBROW_CLASS}>
            Current snapshot
          </p>
          <h2 className={DASHBOARD_PANEL_TITLE_CLASS}>Moon now</h2>
        </div>
      </header>

      {astronomyStatus ? (
        <DashboardStatusBanner tone={astronomyStatus.tone}>
          {astronomyStatus.message}
        </DashboardStatusBanner>
      ) : null}

      <section className="grid gap-2.5 lg:grid-cols-[minmax(0,1.15fr)_minmax(14rem,0.85fr)]">
        <div className="rounded-[1.1rem] border border-sky-200/10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_rgba(15,23,42,0.58)_40%,_rgba(2,6,23,0.92)_100%)] px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="flex min-h-[9.25rem] items-stretch gap-4">
            <div className="flex aspect-square self-stretch shrink-0 items-center justify-center overflow-hidden rounded-[1.35rem] bg-slate-950/35">
              <MoonPhaseCircle
                illuminationFrac={moon.illumination_fraction ?? undefined}
                phaseAngleDeg={moon.phase_angle_deg ?? undefined}
                size={132}
                className="h-full w-full"
                variant="photo"
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <div className={DASHBOARD_METRIC_LABEL_CLASS}>Current phase</div>
              <div className="mt-1 text-[1.45rem] font-semibold leading-tight text-slate-50 sm:text-[1.6rem]">
                {moon.phase_name ?? "—"}
              </div>
              <div className="mt-1.5 text-sm text-slate-200/84">
                <span className="text-[1.05rem] font-semibold text-white">
                  {formatPercent(moon.illumination_percent)}
                </span>{" "}
                illuminated
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${visibilityState.badgeClass}`}
                >
                  {visibilityState.badge}
                </span>
                <span className="text-[11px] text-slate-300/70">
                  {visibilityState.detail}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`rounded-[1.1rem] border px-3.5 py-3 ${keyEvent.className}`}
        >
          <div className={DASHBOARD_METRIC_LABEL_CLASS}>{keyEvent.heading}</div>
          <div className="mt-1 text-sm font-semibold text-slate-50">
            {keyEvent.label}
          </div>
          <div className="mt-2 text-[1.2rem] font-semibold leading-tight text-slate-50">
            {keyEvent.value}
          </div>
          <div className={DASHBOARD_SUPPORT_TEXT_CLASS}>{keyEvent.detail}</div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className={`${DASHBOARD_SURFACE_CLASS} flex min-h-[5.5rem] flex-col justify-between`}>
          <div className={DASHBOARD_METRIC_LABEL_CLASS}>Illumination</div>
          <div className="mt-1 text-[1.3rem] font-semibold leading-none text-slate-50">
            {formatPercent(moon.illumination_percent)}
          </div>
          <div className="mt-1 text-[11px] text-slate-300/66">Moonlight</div>
        </div>

        <div
          className={`relative ${DASHBOARD_SURFACE_CLASS} min-h-[5.5rem] px-3 py-2.5`}
        >
          <div className="group/metric inline-flex w-full flex-col" tabIndex={0}>
            <div className={DASHBOARD_METRIC_LABEL_CLASS}>Altitude</div>
            <div className="mt-1 text-[1.18rem] font-semibold leading-tight text-slate-50">
              {formatDegrees(moon.altitude_deg)}
            </div>
            <div className="mt-1 text-[11px] text-slate-300/66">
              Relative to horizon
            </div>
            <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-white/10 bg-slate-950/90 p-3 text-xs text-slate-100 opacity-0 shadow-lg shadow-black/40 backdrop-blur transition group-hover/metric:opacity-100 group-focus-within/metric:opacity-100">
              Altitude relative to the horizon (0° = on the horizon, positive =
              above, negative = below).
            </div>
          </div>
        </div>

        <div
          className={`relative ${DASHBOARD_SURFACE_CLASS} min-h-[5.5rem] px-3 py-2.5`}
        >
          <div className="group/metric inline-flex w-full flex-col" tabIndex={0}>
            <div className={DASHBOARD_METRIC_LABEL_CLASS}>Azimuth</div>
            <div className="mt-1 text-[0.98rem] font-semibold leading-snug text-slate-50">
              {formatAzimuthWithDirection(moon.azimuth_deg)}
            </div>
            <div className="mt-1 text-[11px] text-slate-300/66">Compass bearing</div>
            <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-white/10 bg-slate-950/90 p-3 text-xs text-slate-100 opacity-0 shadow-lg shadow-black/40 backdrop-blur transition group-hover/metric:opacity-100 group-focus-within/metric:opacity-100">
              Azimuth is the Moon&apos;s compass direction along the horizon,
              measured in degrees from true north (0°), moving eastward (90°),
              south (180°), and west (270°).
            </div>
          </div>
        </div>

        <div className={`${DASHBOARD_SURFACE_CLASS} flex min-h-[5.5rem] flex-col justify-between`}>
          <div className={DASHBOARD_METRIC_LABEL_CLASS}>Visible</div>
          <div className="mt-1 text-sm font-semibold text-slate-50">
            {visibilityState.label}
          </div>
          <div className="mt-1 text-[11px] text-slate-300/66">{visibilityState.detail}</div>
        </div>
      </section>

      <footer className={DASHBOARD_META_FOOTER_CLASS}>
        <div>{weatherSummary}</div>
        <div>Source: {summary.meta.calculation_source}</div>
        <div>
          Updated {lastUpdatedLabel}
          {summaryQ.isFetching ? " · updating" : ""}
        </div>
      </footer>
    </div>
  );
}
