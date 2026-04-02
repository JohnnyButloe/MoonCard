"use client";

import LocationSearch from "./LocationSearch";
import {
  useLocation,
  type CachedLocation,
  type StoredLocation,
} from "../providers/LocationProvider";

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
  const { current, isLocating } = useLocation();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050816] text-slate-100">
      <div className="absolute inset-0 overflow-hidden bg-[#030612]">
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-100 brightness-150 contrast-120 saturate-135"
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
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,6,18,0.0),rgba(3,6,18,0.04)_32%,rgba(3,6,18,0.08)_68%,rgba(3,6,18,0.14))]" />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_10%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-10">
        <section>
          <p className="mb-4 text-center text-xs uppercase tracking-[0.38em] text-sky-200/65">
            Mooncard
          </p>
          <h1 className="mx-auto max-w-3xl text-center text-4xl font-medium leading-[0.96] tracking-[-0.04em] text-white/72 sm:text-5xl md:text-6xl">
            <span className="bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(191,219,254,0.52))] bg-clip-text text-transparent">
              Where is the Moon?
            </span>
            <span className="mt-2 block text-white/58"></span>
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
          <p className="mt-8 text-center text-[11px] uppercase tracking-[0.16em] text-slate-200/55">
            Background video: NASA Earth Observatory
          </p>
        </section>
      </div>
    </main>
  );
}
