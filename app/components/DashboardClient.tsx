"use client";

import MoonNowCard from "./MoonCardNow";
import LocationTag from "./LocationTag";
import MoonAltitudeGraph from "./MoonGraph";
import TwilightPhaseBar from "./TwilightPhaseBar";
import LocationSwitcher from "./LocationSwitcher";
import {
  LocationProvider,
  useLocation,
  type CachedLocation,
} from "../providers/LocationProvider";

function DashboardContent() {
  const { active, tz } = useLocation();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative mx-auto max-w-6xl px-6 py-8">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 right-6 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-8 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>

        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-200/60">
              Lunar dashboard
            </p>
            <h1 className="text-2xl font-semibold">Mooncard</h1>
          </div>
          <LocationTag
            label={active.label}
            latitude={active.latitude}
            longitude={active.longitude}
            source={active.source}
          />
        </header>

        <div className="mb-6">
          <LocationSwitcher />
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <section className="lg:col-span-7 xl:col-span-8">
            <MoonNowCard
              lat={active.latitude}
              lon={active.longitude}
              tz={tz}
            />
          </section>
          <section className="flex flex-col gap-6 lg:col-span-5 xl:col-span-4">
            <TwilightPhaseBar
              lat={active.latitude}
              lon={active.longitude}
              tz={tz}
            />
            <MoonAltitudeGraph
              lat={active.latitude}
              lon={active.longitude}
              tz={tz}
            />
          </section>
        </div>
      </div>
    </main>
  );
}

export default function DashboardClient({
  fallback,
}: {
  fallback: CachedLocation;
}) {
  return (
    <LocationProvider fallback={fallback}>
      <DashboardContent />
    </LocationProvider>
  );
}
