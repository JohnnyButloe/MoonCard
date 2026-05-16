"use client";

import { useMoonCard } from "../hooks/useAstronomy";
import { useWeatherNow } from "../hooks/useWeather";
import type { LocationSource } from "../providers/LocationProvider";
import {
  DashboardPanelState,
  DashboardSkeletonBlock,
  DashboardStatusBanner,
} from "./DashboardState";
import {
  DASHBOARD_METRIC_LABEL_CLASS,
  DASHBOARD_PANEL_CLASS,
  DASHBOARD_PANEL_EYEBROW_CLASS,
  DASHBOARD_PANEL_HEADER_CLASS,
  DASHBOARD_PANEL_TITLE_CLASS,
  DASHBOARD_SUPPORT_TEXT_CLASS,
  DASHBOARD_SURFACE_CLASS,
  WeatherCloudSymbol,
  formatLocalDate,
  formatLocalTime,
  weatherLabel,
} from "./moonDashboardShared";

export default function MoonContextCard({
  lat,
  lon,
  tz,
  label,
  onEditLocation,
}: {
  lat: number;
  lon: number;
  tz: string;
  label: string;
  source: LocationSource;
  onEditLocation?: () => void;
}) {
  const summaryQ = useMoonCard(lat, lon, tz, { label });
  const weatherQ = useWeatherNow(lat, lon);

  if (summaryQ.error && !summaryQ.data && weatherQ.error && !weatherQ.data) {
    return (
      <DashboardPanelState
        title="Context unavailable"
        body="Location context and conditions could not be loaded."
        tone="danger"
        minHeightClass="min-h-[18rem]"
      >
        {onEditLocation ? (
          <button
            type="button"
            onClick={onEditLocation}
            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/[0.06]"
          >
            Edit location
          </button>
        ) : null}
      </DashboardPanelState>
    );
  }

  if (!summaryQ.data && !weatherQ.data) {
    return (
      <div className={`${DASHBOARD_PANEL_CLASS} min-h-[18rem]`}>
        <div className={DASHBOARD_PANEL_HEADER_CLASS}>
          <div className="space-y-2">
            <DashboardSkeletonBlock className="h-2 w-20 rounded-full" />
            <DashboardSkeletonBlock className="h-4 w-40" />
          </div>
          <DashboardSkeletonBlock className="h-8 w-20 rounded-full" />
        </div>

        <DashboardSkeletonBlock className="h-16 rounded-xl" />

        <div className="grid grid-cols-2 gap-2">
          <DashboardSkeletonBlock className="h-[4.6rem] rounded-xl" />
          <DashboardSkeletonBlock className="h-[4.6rem] rounded-xl" />
        </div>

        <DashboardSkeletonBlock className="h-[5.4rem] rounded-xl" />
      </div>
    );
  }

  const timestampIso = summaryQ.data?.meta.timestamp_iso;
  const weatherCondition = weatherQ.data?.condition;
  const weatherCloudCover = weatherQ.data?.cloudCoverPct;
  const summaryStatus =
    summaryQ.error && summaryQ.data
      ? {
          tone: "warning" as const,
          message: "Snapshot refresh failed. Showing the last timestamp.",
        }
      : null;
  const weatherStatus =
    weatherQ.error && weatherQ.data
      ? {
          tone: "neutral" as const,
          message: "Weather refresh failed. Showing the last conditions.",
        }
      : weatherQ.error
        ? {
            tone: "neutral" as const,
            message: "Weather is unavailable right now.",
          }
        : null;
  const weatherTitle = weatherCondition
    ? weatherLabel(weatherCondition)
    : weatherQ.error && weatherQ.data
      ? "Last weather"
      : weatherQ.error
        ? "Unavailable"
        : "Loading";
  const weatherDetail =
    typeof weatherCloudCover === "number"
      ? `${Math.round(weatherCloudCover)}% cloud cover`
      : weatherQ.error && weatherQ.data
        ? "Cached conditions"
        : weatherQ.error
          ? "Offline"
          : weatherQ.isLoading
            ? "Syncing live weather"
            : "Live conditions";
  const visibilitySummary =
    summaryQ.data?.visibility.summary ??
    "Viewing guidance is unavailable for this update.";
  const viewingLabel =
    summaryQ.data?.visibility.is_dark_enough_for_viewing === true
      ? "Good viewing"
      : summaryQ.data?.visibility.is_dark_enough_for_viewing === false
        ? "Bright sky"
        : "Viewing unknown";
  return (
    <div className={`${DASHBOARD_PANEL_CLASS} min-h-[18rem]`}>
      <header className={DASHBOARD_PANEL_HEADER_CLASS}>
        <div className="min-w-0">
          <p className={DASHBOARD_PANEL_EYEBROW_CLASS}>Context</p>
          <h2 className={DASHBOARD_PANEL_TITLE_CLASS}>Viewing conditions & weather</h2>
        </div>
        {onEditLocation ? (
          <button
            type="button"
            onClick={onEditLocation}
            className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-100 transition hover:border-white/20 hover:bg-white/[0.06]"
          >
            Edit
          </button>
        ) : null}
      </header>

      {summaryStatus ? (
        <DashboardStatusBanner tone={summaryStatus.tone}>
          {summaryStatus.message}
        </DashboardStatusBanner>
      ) : null}

      {weatherStatus ? (
        <DashboardStatusBanner tone={weatherStatus.tone}>
          {weatherStatus.message}
        </DashboardStatusBanner>
      ) : null}

      <section className={DASHBOARD_SURFACE_CLASS}>
        <div className={DASHBOARD_METRIC_LABEL_CLASS}>Viewing conditions</div>
        <div className="mt-1 text-base font-semibold text-slate-50">
          {viewingLabel}
        </div>
        <div className={DASHBOARD_SUPPORT_TEXT_CLASS}>{visibilitySummary}</div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <div className={DASHBOARD_SURFACE_CLASS}>
          <div className={DASHBOARD_METRIC_LABEL_CLASS}>Local date</div>
          <div className="mt-1 text-sm font-semibold text-slate-100">
            {formatLocalDate(timestampIso, tz)}
          </div>
        </div>

        <div className={DASHBOARD_SURFACE_CLASS}>
          <div className={DASHBOARD_METRIC_LABEL_CLASS}>Local time</div>
          <div className="mt-1 text-sm font-semibold text-slate-100">
            {formatLocalTime(timestampIso, tz)}
          </div>
        </div>
      </section>

      <section className={DASHBOARD_SURFACE_CLASS}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0 rounded-full border border-white/10 bg-slate-950/55 p-2">
            <WeatherCloudSymbol condition={weatherCondition} size={26} />
          </div>
          <div className="min-w-0">
            <div className={DASHBOARD_METRIC_LABEL_CLASS}>Weather</div>
            <div className="mt-1 text-sm font-semibold text-slate-50">
              {weatherTitle}
            </div>
            <div className={DASHBOARD_SUPPORT_TEXT_CLASS}>{weatherDetail}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
