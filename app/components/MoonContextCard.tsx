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
  WeatherCloudSymbol,
  formatLocalDate,
  formatLocalTime,
  weatherLabel,
} from "./moonDashboardShared";

function sourceLabel(source: LocationSource): string {
  switch (source) {
    case "current":
      return "Current";
    case "home":
      return "Home";
    case "saved":
      return "Saved";
    default:
      return "Default";
  }
}

function formatCoordinate(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}°`;
}

export default function MoonContextCard({
  lat,
  lon,
  tz,
  label,
  source,
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
      <div className="flex h-full min-h-[18rem] w-full flex-col gap-3 rounded-[1.5rem] bg-slate-950/70 p-4 shadow-lg shadow-black/25 ring-1 ring-white/10 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
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
  const updatedLabel =
    summaryQ.dataUpdatedAt > 0
      ? formatLocalTime(new Date(summaryQ.dataUpdatedAt).toISOString(), tz)
      : "—";

  return (
    <div className="flex h-full min-h-[18rem] w-full flex-col gap-3 rounded-[1.5rem] bg-slate-950/70 p-4 shadow-lg shadow-black/25 ring-1 ring-white/10 backdrop-blur">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.26em] text-sky-200/52">
            Context
          </p>
          <h2 className="mt-1 text-sm font-semibold tracking-tight text-slate-50">
            Location & conditions
          </h2>
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

      <section className="rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-300/60">
              Location
            </div>
            <div className="mt-1 truncate text-base font-semibold text-slate-50">
              {label}
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-300/72">
            {sourceLabel(source)}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-300/72">
          <span>{formatCoordinate(lat)}</span>
          <span>{formatCoordinate(lon)}</span>
          <span>{tz}</span>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-300/60">
            Local date
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-100">
            {formatLocalDate(timestampIso, tz)}
          </div>
        </div>

        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-300/60">
            Local time
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-100">
            {formatLocalTime(timestampIso, tz)}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0 rounded-full border border-white/10 bg-slate-950/55 p-2">
            <WeatherCloudSymbol condition={weatherCondition} size={26} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-300/60">
              Weather
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-50">
              {weatherTitle}
            </div>
            <div className="mt-1 text-[11px] leading-relaxed text-slate-300/72">
              {weatherDetail}
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-white/8 pt-2 text-[10px] text-slate-400/72">
        <div>Snapshot updated {updatedLabel}</div>
        <div>{summaryQ.isFetching || weatherQ.isFetching ? "Syncing live data" : "Live context"}</div>
      </footer>
    </div>
  );
}
