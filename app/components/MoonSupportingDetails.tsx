"use client";

import { useMoonCard } from "../hooks/useAstronomy";
import {
  DashboardPanelState,
  DashboardSkeletonBlock,
  DashboardStatusBanner,
} from "./DashboardState";
import {
  DASHBOARD_META_FOOTER_CLASS,
  DASHBOARD_METRIC_LABEL_CLASS,
  DASHBOARD_PANEL_CLASS,
  DASHBOARD_PANEL_EYEBROW_CLASS,
  DASHBOARD_PANEL_TITLE_CLASS,
  DASHBOARD_SUPPORT_TEXT_CLASS,
  DASHBOARD_SURFACE_CLASS,
  formatLocalTime,
  formatTimeOrDateTime,
} from "./moonDashboardShared";

function formatTwilightLabel(value: string | null | undefined): string {
  if (!value) return "—";

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function MoonSupportingDetails({
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
        title="Supporting details unavailable"
        body="Rise/set details could not be loaded right now."
        tone="danger"
        minHeightClass="min-h-[19rem]"
      />
    );
  }

  if (!summaryQ.data) {
    return (
      <div className={`${DASHBOARD_PANEL_CLASS} min-h-[19rem]`}>
        <div className="space-y-2">
          <DashboardSkeletonBlock className="h-2 w-24 rounded-full" />
          <DashboardSkeletonBlock className="h-4 w-40" />
        </div>

        <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <DashboardSkeletonBlock
              key={`support-details-skeleton-${index}`}
              className="h-[4.8rem] rounded-xl"
            />
          ))}
        </div>

        <DashboardSkeletonBlock className="h-[5.2rem] rounded-xl" />
        <DashboardSkeletonBlock className="h-[4.8rem] rounded-xl" />
      </div>
    );
  }

  const summary = summaryQ.data;
  const status =
    summaryQ.error
      ? {
          tone: "warning" as const,
          message: "Supporting details refresh failed. Showing the last update.",
        }
      : summary.errors.length > 0
        ? {
            tone: "warning" as const,
            message: "Some supporting astronomy details are limited right now.",
          }
        : null;
  const events = [
    {
      label: "Moonrise",
      value: formatTimeOrDateTime(summary.moon.moonrise ?? undefined, tz),
    },
    {
      label: "High moon",
      value: formatTimeOrDateTime(summary.moon.high_moon ?? undefined, tz),
    },
    {
      label: "Moonset",
      value: formatTimeOrDateTime(summary.moon.moonset ?? undefined, tz),
    },
    {
      label: "Low moon",
      value: formatTimeOrDateTime(summary.moon.low_moon ?? undefined, tz),
    },
    {
      label: "Sunrise",
      value: formatTimeOrDateTime(summary.sun.sunrise ?? undefined, tz),
    },
    {
      label: "Sunset",
      value: formatTimeOrDateTime(summary.sun.sunset ?? undefined, tz),
    },
  ];
  const updatedLabel =
    summaryQ.dataUpdatedAt > 0
      ? formatLocalTime(new Date(summaryQ.dataUpdatedAt).toISOString(), tz)
      : "—";
  const visibilitySummary =
    summary.visibility.summary ?? "Viewing guidance is unavailable for this update.";
  const viewingLabel =
    summary.visibility.is_dark_enough_for_viewing === true
      ? "Good viewing"
      : summary.visibility.is_dark_enough_for_viewing === false
        ? "Bright sky"
        : "Viewing unknown";

  return (
    <div className={`${DASHBOARD_PANEL_CLASS} min-h-[19rem]`}>
      <header className="min-w-0">
        <p className={DASHBOARD_PANEL_EYEBROW_CLASS}>Supporting context</p>
        <h2 className={DASHBOARD_PANEL_TITLE_CLASS}>Rise/set details</h2>
      </header>

      {status ? (
        <DashboardStatusBanner tone={status.tone}>
          {status.message}
        </DashboardStatusBanner>
      ) : null}

      <section className="grid grid-cols-2 gap-2 xl:grid-cols-3">
        {events.map((event) => (
          <div
            key={event.label}
            className={`${DASHBOARD_SURFACE_CLASS} min-h-[5.4rem] px-3 py-2.5`}
          >
            <div className={DASHBOARD_METRIC_LABEL_CLASS}>{event.label}</div>
            <div className="mt-1 text-[13px] font-semibold leading-snug text-slate-100">
              {event.value}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className={DASHBOARD_SURFACE_CLASS}>
          <div className={DASHBOARD_METRIC_LABEL_CLASS}>Viewing conditions</div>
          <div className="mt-1 text-sm font-semibold text-slate-50">
            {viewingLabel}
          </div>
          <div className={DASHBOARD_SUPPORT_TEXT_CLASS}>{visibilitySummary}</div>
        </div>

        <div className={DASHBOARD_SURFACE_CLASS}>
          <div className={DASHBOARD_METRIC_LABEL_CLASS}>Twilight</div>
          <div className="mt-1 text-sm font-semibold text-slate-50">
            {formatTwilightLabel(summary.twilight.current_phase)}
          </div>
          <div className={DASHBOARD_SUPPORT_TEXT_CLASS}>
            Next transition {formatTimeOrDateTime(summary.twilight.next_transition ?? undefined, tz)}
          </div>
        </div>
      </section>

      <footer className={DASHBOARD_META_FOOTER_CLASS}>
        <div>Source: {summary.meta.calculation_source}</div>
        <div>
          Updated {updatedLabel}
          {summaryQ.isFetching ? " · updating" : ""}
        </div>
      </footer>
    </div>
  );
}
