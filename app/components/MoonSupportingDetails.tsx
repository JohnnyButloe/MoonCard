"use client";

import { useMoonCard } from "../hooks/useAstronomy";
import {
  DashboardPanelState,
  DashboardSkeletonBlock,
  DashboardStatusBanner,
} from "./DashboardState";
import {
  DASHBOARD_META_FOOTER_CLASS,
  DASHBOARD_METRIC_TILE_CLASS,
  DASHBOARD_METRIC_LABEL_CLASS,
  DASHBOARD_MUTED_TEXT_CLASS,
  DASHBOARD_PANEL_CLASS,
  DASHBOARD_PANEL_EYEBROW_CLASS,
  DASHBOARD_PANEL_TITLE_CLASS,
  DASHBOARD_SUPPORT_TEXT_CLASS,
  DASHBOARD_SURFACE_CLASS,
  DASHBOARD_VALUE_CLASS,
  formatLocalTime,
  formatTimeOrDateTime,
} from "./moonDashboardShared";

function formatDegrees(value: number | null | undefined): string {
  return typeof value === "number" ? `${Math.round(value)}°` : "—";
}

function toCompass(azDeg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const normalized = ((azDeg % 360) + 360) % 360;
  return dirs[Math.round(normalized / 45) % dirs.length];
}

function formatAzimuthWithDirection(azDeg: number | null | undefined): string {
  if (typeof azDeg !== "number") return "—";

  const normalized = Math.round(((azDeg % 360) + 360) % 360);
  return `${toCompass(normalized)} (${normalized}°)`;
}

function formatVisibilityLabel(isUp: boolean | null | undefined): string {
  if (isUp === true) return "Above horizon";
  if (isUp === false) return "Below horizon";
  return "Horizon pending";
}

function formatTwilightLabel(value: string | null | undefined): string {
  if (!value) return "Unavailable";

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatClockTime(iso: string | null | undefined, tz: string): string {
  if (!iso) return "—";

  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  }).format(d);
}

function formatTwilightWindow(
  dawnIso: string | null | undefined,
  duskIso: string | null | undefined,
  tz: string,
): string {
  const dawn = formatClockTime(dawnIso, tz);
  const dusk = formatClockTime(duskIso, tz);

  if (dawn === "—" && dusk === "—") return "—";
  return `${dawn} / ${dusk}`;
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
  const positionItems = [
    {
      label: "Moon altitude",
      value: formatDegrees(summary.moon.altitude_deg),
      detail: formatVisibilityLabel(summary.moon.is_up),
    },
    {
      label: "Moon azimuth",
      value: formatAzimuthWithDirection(summary.moon.azimuth_deg),
      detail: "Current bearing",
    },
    {
      label: "Sun altitude",
      value: formatDegrees(summary.sun.altitude_deg),
      detail: formatVisibilityLabel(summary.sun.is_up),
    },
    {
      label: "Sun azimuth",
      value: formatAzimuthWithDirection(summary.sun.azimuth_deg),
      detail: "Current bearing",
    },
  ];
  const twilightItems = [
    {
      label: "Current phase",
      value: formatTwilightLabel(summary.twilight.current_phase),
    },
    {
      label: "Next transition",
      value: formatTimeOrDateTime(summary.twilight.next_transition ?? undefined, tz),
    },
    {
      label: "Civil twilight",
      value: formatTwilightWindow(
        summary.twilight.civil_dawn,
        summary.twilight.civil_dusk,
        tz,
      ),
    },
    {
      label: "Nautical twilight",
      value: formatTwilightWindow(
        summary.twilight.nautical_dawn,
        summary.twilight.nautical_dusk,
        tz,
      ),
    },
    {
      label: "Astronomical twilight",
      value: formatTwilightWindow(
        summary.twilight.astronomical_dawn,
        summary.twilight.astronomical_dusk,
        tz,
      ),
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
        <h2 className={DASHBOARD_PANEL_TITLE_CLASS}>Extended lunar details</h2>
      </header>

      {status ? (
        <DashboardStatusBanner tone={status.tone}>
          {status.message}
        </DashboardStatusBanner>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="space-y-3">
          <section className={DASHBOARD_SURFACE_CLASS}>
            <div className={DASHBOARD_METRIC_LABEL_CLASS}>Exact position</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {positionItems.map((item) => (
                <div
                  key={item.label}
                  className={`${DASHBOARD_METRIC_TILE_CLASS} min-h-[5rem]`}
                >
                  <div className={DASHBOARD_METRIC_LABEL_CLASS}>{item.label}</div>
                  <div className={`${DASHBOARD_VALUE_CLASS} text-[13px] leading-snug`}>
                    {item.value}
                  </div>
                  <div className={DASHBOARD_MUTED_TEXT_CLASS}>{item.detail}</div>
                </div>
              ))}
            </div>
          </section>

          <section className={DASHBOARD_SURFACE_CLASS}>
            <div className={DASHBOARD_METRIC_LABEL_CLASS}>Moon and sun events</div>
            <div className="mt-2 grid grid-cols-2 gap-2 xl:grid-cols-3">
              {events.map((event) => (
                <div
                  key={event.label}
                  className={`${DASHBOARD_METRIC_TILE_CLASS} min-h-[5.25rem]`}
                >
                  <div className={DASHBOARD_METRIC_LABEL_CLASS}>{event.label}</div>
                  <div className={`${DASHBOARD_VALUE_CLASS} text-[13px] leading-snug`}>
                    {event.value}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-3">
          <section className={DASHBOARD_SURFACE_CLASS}>
            <div className={DASHBOARD_METRIC_LABEL_CLASS}>Twilight details</div>
            <div className="mt-2 space-y-2">
              {twilightItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-start justify-between gap-3 border-b border-white/7 pb-2 last:border-b-0 last:pb-0"
                >
                  <div className={DASHBOARD_METRIC_LABEL_CLASS}>{item.label}</div>
                  <div className="text-right text-[12px] font-medium text-slate-100">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={DASHBOARD_SURFACE_CLASS}>
            <div className={DASHBOARD_METRIC_LABEL_CLASS}>Viewing notes</div>
            <div className="mt-1 text-sm font-semibold text-slate-50">
              {viewingLabel}
            </div>
            <div className={DASHBOARD_SUPPORT_TEXT_CLASS}>{visibilitySummary}</div>
          </section>
        </div>
      </div>

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
