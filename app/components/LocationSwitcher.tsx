"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { searchPlaces, type Place } from "../lib/geocode";
import { useLocation } from "../providers/LocationProvider";

function formatPlaceLabel(place: Place) {
  return [place.name, place.region, place.country].filter(Boolean).join(", ");
}

export default function LocationSwitcher() {
  const { activeId, current, isLocating, setActiveById, addSavedLocation } =
    useLocation();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [results, setResults] = useState<Place[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const nextQuery = deferredQuery.trim();
    if (nextQuery.length < 2) return;

    const controller = new AbortController();
    let cancelled = false;

    void searchPlaces(nextQuery, 6, controller.signal)
      .then((nextResults) => {
        if (cancelled) return;
        startTransition(() => {
          setResults(nextResults);
          setStatus("ready");
        });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        if (cause instanceof Error && cause.name === "AbortError") return;
        setResults([]);
        setStatus("ready");
        setError("Location search is temporarily unavailable.");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [deferredQuery, startTransition]);

  const showResults = query.trim().length >= 2;
  const isSearching = status === "loading" || isPending;
  const currentLabel = useMemo(() => {
    if (isLocating && !current) return "Locating current position...";
    if (!current) return "Current location unavailable";
    return current.label;
  }, [current, isLocating]);

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 md:flex-row md:items-start md:justify-between">
      <button
        type="button"
        onClick={() => setActiveById("current")}
        disabled={!current}
        className={`min-w-0 rounded-full border px-4 py-2 text-left transition md:max-w-[24rem] ${
          activeId === "current"
            ? "border-sky-200/60 bg-sky-400/20 text-sky-100"
            : "border-white/10 bg-white/5 text-sky-100/80 hover:border-white/20 hover:text-sky-100"
        } ${!current ? "cursor-not-allowed opacity-50" : ""}`}
        title={current ? "Switch to your detected current location" : undefined}
      >
        <span className="block text-[11px] uppercase tracking-[0.22em] text-sky-100/55">
          Current
        </span>
        <span className="block truncate text-sm font-medium">{currentLabel}</span>
      </button>

      <div className="relative w-full md:max-w-md">
        <label
          htmlFor="location-switcher-search"
          className="mb-1.5 block text-[11px] uppercase tracking-[0.22em] text-sky-100/55"
        >
          Change location
        </label>
        <input
          id="location-switcher-search"
          type="search"
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            if (nextQuery.trim().length < 2) {
              setResults([]);
              setError("");
              setStatus("idle");
              return;
            }
            setError("");
            setStatus("loading");
          }}
          placeholder="Search city, town, or region"
          className="w-full rounded-full border border-white/12 bg-slate-950/22 px-4 py-2.5 text-sm text-white/90 outline-none transition placeholder:text-slate-400/85 focus:border-sky-300/45 focus:bg-slate-950/30"
        />

        {showResults ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/95 p-2 shadow-lg shadow-black/40 backdrop-blur">
            {isSearching ? (
              <p className="px-3 py-2 text-sm text-sky-100/72">
                Searching locations...
              </p>
            ) : null}

            {!isSearching && error ? (
              <p className="px-3 py-2 text-sm text-rose-200/88">{error}</p>
            ) : null}

            {!isSearching && !error && results.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-300/68">
                No matches found. Try a nearby city or broader region.
              </p>
            ) : null}

            {!isSearching && results.length > 0 ? (
              <div className="space-y-1">
                {results.map((place) => {
                  const label = formatPlaceLabel(place);
                  return (
                    <button
                      key={`${place.latitude}-${place.longitude}-${place.name}`}
                      type="button"
                      onClick={() => {
                        addSavedLocation({
                          label,
                          latitude: place.latitude,
                          longitude: place.longitude,
                          tz: place.timezone,
                        });
                        setQuery("");
                        setResults([]);
                        setStatus("idle");
                        setError("");
                      }}
                      className="flex w-full items-center justify-between rounded-xl border border-transparent px-3 py-2 text-left transition hover:border-sky-300/35 hover:bg-sky-300/7"
                    >
                      <span className="text-sm font-medium text-white/90">
                        {label}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.22em] text-sky-100/55">
                        Select
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
