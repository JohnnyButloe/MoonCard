"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MoonNowCard from "./MoonCardNow";
import MoonSkySummaryBanner from "./MoonSkySummaryBanner";
import MoonContextCard from "./MoonContextCard";
import LocationTag from "./LocationTag";
import MoonAltitudeGraph from "./MoonGraph";
import MoonCalendarPreview from "./MoonCalendarPreview";
import MoonPhaseCalendar from "./MoonPhaseCalendar";
import LocationSearch from "./LocationSearch";
import LocationOnboarding from "./LocationOnboarding";
import { DashboardPanelState } from "./DashboardState";
import {
  LocationProvider,
  useLocation,
  type StoredLocation,
  type CachedLocation,
} from "../providers/LocationProvider";

function DashboardSectionFrame({
  id,
  title,
  children,
}: {
  id: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={title ? id : undefined}
      className="rounded-[1.7rem] border border-white/8 bg-white/[0.025] p-3 sm:p-4"
    >
      {title ? (
        <div className="mb-3 border-b border-white/8 pb-2.5 sm:mb-3.5">
          <h2
            id={id}
            className="text-[1.02rem] font-semibold tracking-tight text-slate-50 sm:text-[1.08rem]"
          >
            {title}
          </h2>
        </div>
      ) : null}
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
    <main className="min-h-screen bg-[#050816] text-slate-100">
      {isLocationEditorOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm"
          onClick={() => setIsLocationEditorOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-slate-900/95 p-5 shadow-2xl shadow-black/50"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-sky-100/55">
                  Edit location
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white/92">
                  Change the dashboard location
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsLocationEditorOpen(false)}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300/80 transition hover:border-white/20 hover:text-white"
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
                className={`w-full rounded-[1.5rem] border px-4 py-3 text-left transition ${
                  current
                    ? "border-sky-300/30 bg-sky-300/8 text-sky-50/90 hover:border-sky-300/45 hover:bg-sky-300/12"
                    : "cursor-not-allowed border-white/10 bg-white/3 text-slate-400/85"
                }`}
              >
                <span className="block text-[11px] uppercase tracking-[0.24em] text-sky-100/55">
                  Current location
                </span>
                <span className="mt-1 block text-base font-medium">
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

      <div className="relative mx-auto max-w-[1240px] px-4 py-3 sm:px-5 sm:py-4 xl:px-6 xl:py-5">
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

        <header className="mb-4 flex flex-wrap items-start justify-between gap-4 sm:mb-5">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.24em] text-sky-200/54">
              Lunar dashboard
            </p>
            <h1 className="mt-1 text-[1.65rem] font-semibold tracking-tight text-slate-50 sm:text-[1.82rem]">
              Mooncard
            </h1>
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
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              Set location
            </button>
          )}
        </header>

        {hasActiveLocation ? (
          <div className="space-y-4 sm:space-y-5">
            <DashboardSectionFrame id="current-moon-heading">
              <div className="space-y-3.5 lg:space-y-4">
                <MoonSkySummaryBanner
                  lat={active.latitude}
                  lon={active.longitude}
                  tz={tz}
                  label={active.label}
                />

                <div className="grid gap-3.5 lg:grid-cols-12 lg:gap-4">
                  <section className="flex min-w-0 lg:col-span-8">
                    <MoonNowCard
                      lat={active.latitude}
                      lon={active.longitude}
                      tz={tz}
                      label={active.label}
                    />
                  </section>
                  <section className="flex min-w-0 lg:col-span-4">
                    <MoonContextCard
                      lat={active.latitude}
                      lon={active.longitude}
                      tz={tz}
                      label={active.label}
                      source={active.source}
                      onEditLocation={() => setIsLocationEditorOpen(true)}
                    />
                  </section>
                </div>
              </div>
            </DashboardSectionFrame>

            <DashboardSectionFrame
              id="sky-timeline-heading"
              title="Today's Sky Timeline"
            >
              <div className="min-w-0">
                <MoonAltitudeGraph
                  lat={active.latitude}
                  lon={active.longitude}
                  tz={tz}
                  label={active.label}
                />
              </div>
            </DashboardSectionFrame>

            <DashboardSectionFrame
              id="lunar-calendar-heading"
              title="Lunar Calendar"
            >
              <div className="grid gap-3.5 lg:grid-cols-12 lg:gap-4">
                <section className="flex min-w-0 lg:col-span-8">
                  <MoonPhaseCalendar key={tz} tz={tz} compact />
                </section>
                <section className="flex min-w-0 lg:col-span-4">
                  <MoonCalendarPreview key={`${tz}-events`} tz={tz} title="Next lunar events" />
                </section>
              </div>
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
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/[0.06]"
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
