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
  DASHBOARD_BADGE_CLASS,
  DASHBOARD_ICON_BADGE_CLASS,
  DASHBOARD_METRIC_LABEL_CLASS,
  DASHBOARD_MUTED_TEXT_CLASS,
  DASHBOARD_PANEL_CLASS,
  DASHBOARD_PANEL_EYEBROW_CLASS,
  DASHBOARD_PANEL_HEADER_CLASS,
  DASHBOARD_PANEL_TITLE_CLASS,
  DASHBOARD_SUPPORT_TEXT_CLASS,
  DASHBOARD_SURFACE_CLASS,
  DASHBOARD_VALUE_CLASS,
  WeatherCloudSymbol,
  formatLocalDate,
  formatLocalTime,
  formatTimeOrDateTime,
  getViewingAssessment,
  weatherLabel,
} from "./moonDashboardShared";

function formatTwilightLabel(value: string | null | undefined): string {
  if (!value) return "Unavailable";

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function MoonContextCard({
  lat,
  lon,
  tz,
  label,
  onEditLocation,
  variant = "default",
}: {
  lat: number;
  lon: number;
  tz: string;
  label: string;
  source: LocationSource;
  onEditLocation?: () => void;
  variant?: "default" | "compact";
}) {
  const summaryQ = useMoonCard(lat, lon, tz, { label });
  const weatherQ = useWeatherNow(lat, lon);
  const isCompact = variant === "compact";

  if (summaryQ.error && !summaryQ.data && weatherQ.error && !weatherQ.data) {
    return (
      <DashboardPanelState
        title="Context unavailable"
        body="Location context and conditions could not be loaded."
        tone="danger"
        minHeightClass={isCompact ? "min-h-[14rem] md:min-h-[15rem]" : "min-h-[18rem]"}
      >
        {onEditLocation ? (
          <button
            type="button"
            onClick={onEditLocation}
            className={`${DASHBOARD_BADGE_CLASS} px-3 py-1.5 text-xs transition hover:border-white/20 hover:bg-white/[0.06]`}
          >
            Edit location
          </button>
        ) : null}
      </DashboardPanelState>
    );
  }

  if (!summaryQ.data && !weatherQ.data) {
    if (isCompact) {
      return (
        <div className={`${DASHBOARD_PANEL_CLASS} min-h-[14rem] gap-3 md:min-h-[15rem]`}>
          <div className={DASHBOARD_PANEL_HEADER_CLASS}>
            <div className="space-y-2">
              <DashboardSkeletonBlock className="h-2 w-20 rounded-full" />
              <DashboardSkeletonBlock className="h-4 w-32" />
            </div>
            <DashboardSkeletonBlock className="h-8 w-16 rounded-full" />
          </div>

          <DashboardSkeletonBlock className="h-[5.8rem] rounded-[1.1rem]" />

          <div className={`${DASHBOARD_SURFACE_CLASS} space-y-3 py-3`}>
            <div className="space-y-2">
              <DashboardSkeletonBlock className="h-2 w-16 rounded-full" />
              <DashboardSkeletonBlock className="h-4 w-24" />
              <DashboardSkeletonBlock className="h-3 w-32 rounded-full" />
            </div>

            <div className="space-y-2 border-t border-white/7 pt-3">
              <div className="space-y-2">
                <DashboardSkeletonBlock className="h-2 w-14 rounded-full" />
                <DashboardSkeletonBlock className="h-4 w-24" />
                <DashboardSkeletonBlock className="h-3 w-28 rounded-full" />
              </div>

              <div className="flex items-start gap-3 border-t border-white/7 pt-3">
                <DashboardSkeletonBlock className="h-9 w-9 rounded-full" />
                <div className="space-y-2">
                  <DashboardSkeletonBlock className="h-2 w-14 rounded-full" />
                  <DashboardSkeletonBlock className="h-4 w-28" />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

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
  const viewingAssessment = getViewingAssessment({
    isDarkEnoughForViewing: summaryQ.data?.visibility.is_dark_enough_for_viewing,
    visibilitySummary: summaryQ.data?.visibility.summary,
    weatherCondition,
    weatherCloudCover,
  });
  const twilightValue = formatTwilightLabel(summaryQ.data?.twilight.current_phase);
  const twilightDetail = summaryQ.data?.twilight.next_transition
    ? `Next transition ${formatTimeOrDateTime(summaryQ.data.twilight.next_transition, tz)}`
    : "Next transition unavailable.";

  if (isCompact) {
    return (
      <div className={`${DASHBOARD_PANEL_CLASS} min-h-[14rem] gap-2.5 px-3.5 py-3.5 md:min-h-[15rem]`}>
        <header className={DASHBOARD_PANEL_HEADER_CLASS}>
          <div className="min-w-0">
            <p className={DASHBOARD_PANEL_EYEBROW_CLASS}>Context</p>
            <h2 className={DASHBOARD_PANEL_TITLE_CLASS}>Viewing conditions</h2>
          </div>
          {onEditLocation ? (
            <button
              type="button"
              onClick={onEditLocation}
              className={`${DASHBOARD_BADGE_CLASS} shrink-0 transition hover:border-white/20 hover:bg-white/[0.06]`}
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

        <section className={`${DASHBOARD_SURFACE_CLASS} flex flex-1 flex-col justify-between gap-2 px-3 py-2.5`}>
          <div>
            <div className={DASHBOARD_METRIC_LABEL_CLASS}>Viewing</div>
            <div className="mt-1 text-base font-semibold text-slate-50">
              {viewingAssessment.label}
            </div>
            <div className={DASHBOARD_SUPPORT_TEXT_CLASS}>
              {viewingAssessment.summary}
            </div>
          </div>

          <div className="grid gap-2 border-t border-white/7 pt-2">
            <div className="min-w-0">
              <div className={DASHBOARD_METRIC_LABEL_CLASS}>Twilight</div>
              <div className={`${DASHBOARD_VALUE_CLASS} mt-0.5 leading-tight`}>
                {twilightValue}
              </div>
              <div className={`mt-0.5 ${DASHBOARD_MUTED_TEXT_CLASS}`}>
                {twilightDetail}
              </div>
            </div>

            <div className="flex min-w-0 items-start gap-2.5 border-t border-white/7 pt-2">
              <div className={`${DASHBOARD_ICON_BADGE_CLASS} mt-0.5 h-9 w-9 shrink-0`}>
                <WeatherCloudSymbol condition={weatherCondition} size={24} />
              </div>
              <div className="min-w-0">
                <div className={DASHBOARD_METRIC_LABEL_CLASS}>Weather</div>
                <div className={DASHBOARD_VALUE_CLASS}>
                  {weatherTitle}
                  <span className="font-normal text-slate-300/76"> · {weatherDetail}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

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
            className={`${DASHBOARD_BADGE_CLASS} shrink-0 transition hover:border-white/20 hover:bg-white/[0.06]`}
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
          {viewingAssessment.label}
        </div>
        <div className={DASHBOARD_SUPPORT_TEXT_CLASS}>
          {viewingAssessment.summary}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <div className={DASHBOARD_SURFACE_CLASS}>
          <div className={DASHBOARD_METRIC_LABEL_CLASS}>Local date</div>
          <div className={DASHBOARD_VALUE_CLASS}>
            {formatLocalDate(timestampIso, tz)}
          </div>
        </div>

        <div className={DASHBOARD_SURFACE_CLASS}>
          <div className={DASHBOARD_METRIC_LABEL_CLASS}>Local time</div>
          <div className={DASHBOARD_VALUE_CLASS}>
            {formatLocalTime(timestampIso, tz)}
          </div>
        </div>
      </section>

      <section className={DASHBOARD_SURFACE_CLASS}>
        <div className="flex items-start gap-3">
          <div className={`${DASHBOARD_ICON_BADGE_CLASS} mt-0.5 shrink-0`}>
            <WeatherCloudSymbol condition={weatherCondition} size={26} />
          </div>
          <div className="min-w-0">
            <div className={DASHBOARD_METRIC_LABEL_CLASS}>Weather</div>
            <div className={DASHBOARD_VALUE_CLASS}>
              {weatherTitle}
            </div>
            <div className={`mt-1 ${DASHBOARD_MUTED_TEXT_CLASS}`}>{weatherDetail}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
