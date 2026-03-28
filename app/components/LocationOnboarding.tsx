"use client";

import LocationSearch from "./LocationSearch";
import {
  useLocation,
  type CachedLocation,
  type StoredLocation,
} from "../providers/LocationProvider";

function HistoryButton({
  label,
  meta,
  onClick,
}: {
  label: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-white/10 bg-white/3 px-3 py-1.5 text-left transition hover:border-white/20 hover:bg-white/7"
    >
      <div className="text-xs font-medium text-white/90">
        {label.length > 20 ? `${label.slice(0, 20)}…` : label}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-sky-100/55">
        {meta}
      </div>
    </button>
  );
}

function toStoredLocation(location: CachedLocation): StoredLocation {
  return {
    label: location.label,
    latitude: location.latitude,
    longitude: location.longitude,
    tz: location.tz,
  };
}

export default function LocationOnboarding({
  onSelect,
}: {
  onSelect: (location: StoredLocation) => void;
}) {
  const { current, home, saved, isLocating } = useLocation();
  const history = [
    current
      ? {
          key: "current",
          label: current.label,
          meta: isLocating ? "Locating" : "Current",
          location: current,
        }
      : null,
    home
      ? {
          key: "home",
          label: home.label,
          meta: "Home",
          location: home,
        }
      : null,
    ...saved.map((location) => ({
      key: location.id,
      label: location.label,
      meta: "Saved",
      location,
    })),
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    meta: string;
    location: CachedLocation;
  }>;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050816] text-slate-100">
      <div className="absolute inset-0 overflow-hidden bg-[#030612]">
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-74 saturate-125"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="https://eoimages.gsfc.nasa.gov/images/imagerecords/154000/154728/iss073e311235_lrg.jpg"
        >
          <source
            src="https://eoimages.gsfc.nasa.gov/images/imagerecords/154000/154728/iss073e311235_moon_anim.mp4"
            type="video/mp4"
          />
        </video>
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,6,18,0.18),rgba(3,6,18,0.4)_32%,rgba(3,6,18,0.62)_68%,rgba(3,6,18,0.78))]" />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_10%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-10">
        <section>
          <p className="mb-4 text-center text-xs uppercase tracking-[0.38em] text-sky-200/65">
            Mooncard
          </p>
          <h1 className="mx-auto max-w-xl text-center text-4xl font-semibold tracking-tight text-white/92 sm:text-5xl">
            Search for a location to enter the lunar dashboard.
          </h1>
          <div className="mx-auto mt-6 flex max-w-xl justify-center">
            <button
              type="button"
              disabled={!current}
              onClick={() => {
                if (!current) return;
                onSelect(toStoredLocation(current));
              }}
              className={`rounded-full border px-5 py-2.5 text-sm font-medium transition ${
                current
                  ? "border-sky-300/35 bg-sky-300/8 text-sky-50/90 hover:border-sky-300/50 hover:bg-sky-300/14"
                  : "cursor-not-allowed border-white/10 bg-white/3 text-slate-400/85"
              }`}
            >
              {isLocating
                ? "Locating current position…"
                : "Use current location"}
            </button>
          </div>
          <div className="mx-auto mt-8 max-w-xl">
            <LocationSearch onSelect={onSelect} />
          </div>
          {history.length > 0 && (
            <div className="mx-auto mt-6 max-w-xl">
              <p className="mb-3 text-center text-xs uppercase tracking-[0.28em] text-sky-100/55">
                Recent selections
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {history.map((item) => (
                  <HistoryButton
                    key={item.key}
                    label={item.label}
                    meta={item.meta}
                    onClick={() => onSelect(toStoredLocation(item.location))}
                  />
                ))}
              </div>
            </div>
          )}
          <p className="mt-8 text-center text-[11px] uppercase tracking-[0.16em] text-slate-200/55">
            Background video: NASA Earth Observatory
          </p>
        </section>
      </div>
    </main>
  );
}
