"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MoonContextCard from "./MoonContextCard";
import LocationTag from "./LocationTag";
import MoonAltitudeGraph from "./MoonGraph";
import MoonCalendarPreview from "./MoonCalendarPreview";
import { MoonPhaseCircle } from "./MoonPhaseCircle";
import MoonPhaseCalendar from "./MoonPhaseCalendar";
import LocationSearch from "./LocationSearch";
import LocationOnboarding from "./LocationOnboarding";
import MoonTonightHero from "./MoonTonightHero";
import { DashboardPanelState } from "./DashboardState";
import {
  DASHBOARD_BADGE_CLASS,
  DASHBOARD_METRIC_LABEL_CLASS,
  DASHBOARD_MUTED_TEXT_CLASS,
  DASHBOARD_PAGE_CLASS,
  DASHBOARD_PAGE_SHELL_CLASS,
} from "./moonDashboardShared";
import {
  LocationProvider,
  useLocation,
  type StoredLocation,
  type CachedLocation,
} from "../providers/LocationProvider";

function DashboardSectionFrame({
  title,
  className = "",
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className={className}>
      {children}
    </section>
  );
}

function DashboardContent({
  initialView,
}: {
  initialView: "landing" | "dashboard";
}) {
  const router = useRouter();
  const [isLocationEditorOpen, setIsLocationEditorOpen] = useState(false);
  const {
    active,
    tz,
    current,
    isLocating,
    hasCompletedOnboarding,
    selectCurrentLocation,
    selectLocation,
  } = useLocation();

  const handleSelectLocation = (location: StoredLocation) => {
    selectLocation(location);
    router.push("/dashboard");
  };

  const handleUseCurrentLocation = () => {
    if (!current) return;
    selectCurrentLocation();
    router.push("/dashboard");
  };

  useEffect(() => {
    if (!isLocationEditorOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsLocationEditorOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLocationEditorOpen]);

  if (initialView === "landing") {
    return (
      <LocationOnboarding
        onSelect={handleSelectLocation}
        onUseCurrentLocation={handleUseCurrentLocation}
      />
    );
  }

  if (!hasCompletedOnboarding) {
    return (
      <LocationOnboarding
        onSelect={handleSelectLocation}
        onUseCurrentLocation={handleUseCurrentLocation}
      />
    );
  }

  const hasActiveLocation =
    Number.isFinite(active?.latitude) &&
    Number.isFinite(active?.longitude) &&
    typeof tz === "string" &&
    tz.length > 0;

  return (
    <main className={DASHBOARD_PAGE_CLASS}>
      {isLocationEditorOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm"
          onClick={() => setIsLocationEditorOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-slate-900/95 p-5 shadow-2xl shadow-black/50 ring-1 ring-white/8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className={DASHBOARD_METRIC_LABEL_CLASS}>
                  Edit location
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-white/92">
                  Change the dashboard location
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsLocationEditorOpen(false)}
                className={`${DASHBOARD_BADGE_CLASS} bg-transparent px-3 py-1 text-xs text-slate-300/80 transition hover:border-white/20 hover:text-white`}
              >
                Close
              </button>
            </div>

            <div className="mb-5">
              <button
                type="button"
                disabled={!current}
                onClick={() => {
                  if (!current) return;
                  handleUseCurrentLocation();
                  setIsLocationEditorOpen(false);
                }}
                className={`w-full rounded-[1.35rem] px-4 py-3 text-left ring-1 ring-inset transition ${
                  current
                    ? "bg-sky-300/8 text-sky-50/90 ring-sky-300/28 hover:bg-sky-300/12 hover:ring-sky-300/42"
                    : "cursor-not-allowed bg-white/[0.03] text-slate-400/85 ring-white/8"
                }`}
              >
                <span className={DASHBOARD_METRIC_LABEL_CLASS}>
                  Current location
                </span>
                <span className={`mt-1 block text-base font-medium ${current ? "text-inherit" : "text-slate-300/88"}`}>
                  {isLocating && !current
                    ? "Locating current position..."
                    : current?.label ?? "Current location unavailable"}
                </span>
              </button>
            </div>

            <LocationSearch
              onSelect={(location) => {
                handleSelectLocation(location);
                setIsLocationEditorOpen(false);
              }}
            />
          </div>
        </div>
      ) : null}

      <div className={DASHBOARD_PAGE_SHELL_CLASS}>
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 8%, rgba(56,189,248,0.07) 0%, rgba(5,8,22,0.16) 32%, rgba(5,8,22,0.92) 100%)",
            }}
          />
          <div className="absolute -top-28 right-8 h-80 w-80 rounded-full bg-sky-500/12 blur-3xl" />
          <div className="absolute left-6 top-24 h-64 w-64 rounded-full bg-cyan-400/6 blur-3xl" />
          <div className="absolute bottom-0 left-12 h-96 w-96 rounded-full bg-slate-900/30 blur-3xl" />
        </div>

        <header className="mb-2.5 flex flex-wrap items-center justify-between gap-3 sm:mb-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(125,211,252,0.22),rgba(15,23,42,0.82)_68%,rgba(2,6,23,0.96)_100%)] ring-1 ring-inset ring-sky-200/18 shadow-[0_12px_26px_rgba(56,189,248,0.12)]">
              <MoonPhaseCircle
                phaseAngleDeg={66}
                size={24}
                variant="flat"
                className="opacity-95"
              />
            </div>

            <div className="min-w-0 space-y-0.5">
              <p className={DASHBOARD_METRIC_LABEL_CLASS}>
                Lunar dashboard
              </p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="text-[1.65rem] font-semibold tracking-tight text-slate-50 sm:text-[1.82rem]">
                  MoonCard
                </h1>
                <span className="hidden h-1 w-1 rounded-full bg-sky-300/60 sm:inline-block" />
                <p className={`text-xs sm:text-sm ${DASHBOARD_MUTED_TEXT_CLASS}`}>
                  Live lunar visibility planner.
                </p>
              </div>
            </div>
          </div>
          {hasActiveLocation ? (
            <LocationTag
              label={active.label}
              latitude={active.latitude}
              longitude={active.longitude}
              tz={tz}
              source={active.source}
              onClick={() => setIsLocationEditorOpen(true)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsLocationEditorOpen(true)}
              className={`${DASHBOARD_BADGE_CLASS} px-3 py-1.5 text-xs transition hover:border-white/20 hover:bg-white/[0.06]`}
            >
              Set location
            </button>
          )}
        </header>

        {hasActiveLocation ? (
          <div className="grid gap-3.5 sm:gap-4 md:grid-cols-12 md:items-stretch">
            <DashboardSectionFrame
              title="Moon overview"
              className="flex min-w-0 md:col-span-8"
            >
              <section className="flex h-full min-w-0 w-full">
                <MoonTonightHero
                  lat={active.latitude}
                  lon={active.longitude}
                  tz={tz}
                  label={active.label}
                />
              </section>
            </DashboardSectionFrame>

            <DashboardSectionFrame
              title="Viewing conditions and weather"
              className="flex min-w-0 md:col-span-4"
            >
              <MoonContextCard
                lat={active.latitude}
                lon={active.longitude}
                tz={tz}
                label={active.label}
                source={active.source}
                onEditLocation={() => setIsLocationEditorOpen(true)}
                variant="compact"
              />
            </DashboardSectionFrame>

            <DashboardSectionFrame
              title="Today's sky timeline"
              className="min-w-0 md:col-span-12"
            >
              <section className="flex min-w-0">
                <MoonAltitudeGraph
                  lat={active.latitude}
                  lon={active.longitude}
                  tz={tz}
                  label={active.label}
                />
              </section>
            </DashboardSectionFrame>

            <DashboardSectionFrame
              title="Lunar calendar"
              className="min-w-0 md:col-span-8"
            >
              <section className="flex min-w-0">
                <MoonPhaseCalendar key={tz} tz={tz} compact />
              </section>
            </DashboardSectionFrame>

            <DashboardSectionFrame
              title="Next lunar events"
              className="flex min-w-0 md:col-span-4"
            >
              <MoonCalendarPreview
                key={`${tz}-events`}
                tz={tz}
                title="Next lunar events"
              />
            </DashboardSectionFrame>
          </div>
        ) : (
          <section className="mt-1">
            <DashboardPanelState
              title="Choose a location"
              body="Select a place to load the lunar dashboard."
              minHeightClass="min-h-[18rem]"
            >
              <button
                type="button"
                onClick={() => setIsLocationEditorOpen(true)}
                className={`${DASHBOARD_BADGE_CLASS} px-3 py-1.5 text-xs transition hover:border-white/20 hover:bg-white/[0.06]`}
              >
                Set location
              </button>
            </DashboardPanelState>
          </section>
        )}
      </div>
    </main>
  );
}

export default function DashboardClient({
  fallback,
  initialView = "dashboard",
}: {
  fallback: CachedLocation;
  initialView?: "landing" | "dashboard";
}) {
  return (
    <LocationProvider fallback={fallback}>
      <DashboardContent initialView={initialView} />
    </LocationProvider>
  );
}
