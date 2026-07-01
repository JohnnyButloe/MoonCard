"use client";

import { useMoonCard } from "../hooks/useAstronomy";
import {
  DashboardPanelState,
  DashboardSkeletonBlock,
  DashboardStatusBanner,
} from "./DashboardState";
import {
  buildTwilightWindowFrames,
  DASHBOARD_BADGE_MUTED_CLASS,
  DASHBOARD_META_FOOTER_CLASS,
  DASHBOARD_PANEL_CLASS,
  DASHBOARD_PANEL_EYEBROW_CLASS,
  DASHBOARD_PANEL_TITLE_CLASS,
  formatLocalTime,
  formatTwilightWindowSummary,
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

type SupportingDetailRow = {
  label: string;
  value: string;
  valueStyle?: "default" | "pill";
  emphasized?: boolean;
};

type SupportingDetailSection = {
  title: string;
  rows: SupportingDetailRow[];
};

const SUPPORTING_CARD_CLASS = `${DASHBOARD_PANEL_CLASS} gap-2.5 p-3.5 sm:p-3.5`;
const CONTEXT_GRID_CLASS = "grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3";
const CONTEXT_PANEL_CLASS =
  "rounded-[1rem] border border-white/7 bg-white/[0.028] px-2.5 py-1.5 ring-1 ring-inset ring-white/6 sm:px-3 sm:py-2";
const CONTEXT_PANEL_TITLE_CLASS =
  "text-[10px] uppercase tracking-[0.2em] text-slate-200/68";
const CONTEXT_PANEL_ROWS_CLASS = "mt-1.5 space-y-1.5";
const CONTEXT_ROW_CLASS =
  "flex items-start justify-between gap-3 border-t border-white/7 pt-1.5 first:border-t-0 first:pt-0";
const CONTEXT_ROW_LABEL_CLASS =
  "pr-2 text-[11px] font-medium leading-snug text-slate-300/74";
const CONTEXT_ROW_VALUE_CLASS =
  "min-w-0 flex-1 text-right text-[13px] font-semibold leading-snug text-slate-50 tabular-nums";
const CONTEXT_PILL_CLASS =
  `${DASHBOARD_BADGE_MUTED_CLASS} px-2 py-0.5 text-[11px] normal-case tracking-normal text-slate-100/86`;
const CONTEXT_EMPHASIZED_ROW_CLASS = "text-slate-200/86";
const CONTEXT_EMPHASIZED_VALUE_CLASS = "text-slate-50";

function formatSkyStateLabel(value: string | null | undefined): string {
  switch (value) {
    case "day":
      return "Daylight";
    case "civil":
    case "nautical":
    case "astronomical":
      return "Twilight";
    case "dark":
      return "Night";
    default:
      break;
  }

  if (!value) return "Unavailable";
  if (value.includes("twilight")) return "Twilight";
  if (value.includes("day")) return "Daylight";
  if (value.includes("dark") || value.includes("night")) return "Night";

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
        body="Supporting astronomy details could not be loaded right now."
        tone="danger"
        minHeightClass="min-h-[16rem]"
      />
    );
  }

  if (!summaryQ.data) {
    return (
      <div className={`${SUPPORTING_CARD_CLASS} min-h-[16rem]`}>
        <div className="space-y-2">
          <DashboardSkeletonBlock className="h-2 w-24 rounded-full" />
          <DashboardSkeletonBlock className="h-4 w-40" />
        </div>

        <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <DashboardSkeletonBlock
              key={`support-details-skeleton-${index}`}
              className="h-[4.25rem] rounded-xl"
            />
          ))}
        </div>

        <DashboardSkeletonBlock className="h-[3.2rem] rounded-xl" />
        <DashboardSkeletonBlock className="h-[3.8rem] rounded-xl" />
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
  const twilightWindowFrames = buildTwilightWindowFrames(
    summary.twilight,
    summary.sun,
  );
  const sections: SupportingDetailSection[] = [
    {
      title: "Current Sky",
      rows: [
        {
          label: "State",
          value: formatSkyStateLabel(summary.twilight.current_phase),
          valueStyle: "pill",
        },
        {
          label: "Next transition",
          value: formatTimeOrDateTime(
            summary.twilight.next_transition ?? undefined,
            tz,
          ),
        },
      ],
    },
    {
      title: "Moon Position",
      rows: [
        {
          label: "Altitude",
          value: formatDegrees(summary.moon.altitude_deg),
        },
        {
          label: "Horizon",
          value: formatVisibilityLabel(summary.moon.is_up),
          valueStyle: "pill",
        },
        {
          label: "Azimuth",
          value: formatAzimuthWithDirection(summary.moon.azimuth_deg),
        },
      ],
    },
    {
      title: "Sun Position",
      rows: [
        {
          label: "Altitude",
          value: formatDegrees(summary.sun.altitude_deg),
        },
        {
          label: "Horizon",
          value: formatVisibilityLabel(summary.sun.is_up),
          valueStyle: "pill",
        },
        {
          label: "Azimuth",
          value: formatAzimuthWithDirection(summary.sun.azimuth_deg),
        },
      ],
    },
    {
      title: "Lunar Timing",
      rows: [
        {
          label: "High moon",
          value: formatTimeOrDateTime(summary.moon.high_moon ?? undefined, tz),
        },
        {
          label: "Low moon",
          value: formatTimeOrDateTime(summary.moon.low_moon ?? undefined, tz),
        },
      ],
    },
    {
      title: "Solar Timing",
      rows: [
        {
          label: "Sunrise",
          value: formatTimeOrDateTime(summary.sun.sunrise ?? undefined, tz),
        },
        {
          label: "Sunset",
          value: formatTimeOrDateTime(summary.sun.sunset ?? undefined, tz),
        },
      ],
    },
    {
      title: "Twilight Windows",
      rows: [
        {
          label: "Civil",
          value: formatTwilightWindowSummary(twilightWindowFrames.civil, tz),
          emphasized: summary.twilight.current_phase === "civil",
        },
        {
          label: "Nautical",
          value: formatTwilightWindowSummary(
            twilightWindowFrames.nautical,
            tz,
          ),
          emphasized: summary.twilight.current_phase === "nautical",
        },
        {
          label: "Astronomical",
          value: formatTwilightWindowSummary(
            twilightWindowFrames.astronomical,
            tz,
          ),
          emphasized: summary.twilight.current_phase === "astronomical",
        },
      ],
    },
  ];
  const updatedLabel =
    summaryQ.dataUpdatedAt > 0
      ? formatLocalTime(new Date(summaryQ.dataUpdatedAt).toISOString(), tz)
      : "—";

  return (
    <div className={SUPPORTING_CARD_CLASS}>
      <header className="min-w-0">
        <p className={DASHBOARD_PANEL_EYEBROW_CLASS}>Supporting context</p>
        <h2 className={DASHBOARD_PANEL_TITLE_CLASS}>Extended lunar details</h2>
      </header>

      {status ? (
        <DashboardStatusBanner tone={status.tone}>
          {status.message}
        </DashboardStatusBanner>
      ) : null}

      <div className={CONTEXT_GRID_CLASS}>
        {sections.map((section) => (
          <section key={section.title} className={CONTEXT_PANEL_CLASS}>
            <div className={CONTEXT_PANEL_TITLE_CLASS}>{section.title}</div>
            <div className={CONTEXT_PANEL_ROWS_CLASS}>
              {section.rows.map((item) => (
                <div key={item.label} className={CONTEXT_ROW_CLASS}>
                  <div
                    className={`${CONTEXT_ROW_LABEL_CLASS}${item.emphasized ? ` ${CONTEXT_EMPHASIZED_ROW_CLASS}` : ""}`}
                  >
                    {item.label}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`${CONTEXT_ROW_VALUE_CLASS}${item.emphasized ? ` ${CONTEXT_EMPHASIZED_VALUE_CLASS}` : ""}`}
                    >
                      {item.valueStyle === "pill" ? (
                        <span className={CONTEXT_PILL_CLASS}>{item.value}</span>
                      ) : (
                        item.value
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className={`${DASHBOARD_META_FOOTER_CLASS} pt-2 text-slate-400/56`}>
        <div>Source: {summary.meta.calculation_source}</div>
        <div>
          Updated {updatedLabel}
          {summaryQ.isFetching ? " · updating" : ""}
        </div>
      </footer>
    </div>
  );
}
