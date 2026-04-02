"use client";

import {
  useDeferredValue,
  useEffect,
  useId,
  useState,
  useTransition,
} from "react";
import { searchPlaces, type Place } from "../lib/geocode";
import type { StoredLocation } from "../providers/LocationProvider";

function formatPlaceLabel(place: Place) {
  return [place.name, place.region, place.country].filter(Boolean).join(", ");
}

export default function LocationSearch({
  onSelect,
}: {
  onSelect: (location: StoredLocation) => void;
}) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [results, setResults] = useState<Place[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [showHelp, setShowHelp] = useState(false);
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

  const hasQuery = query.trim().length >= 2;
  const isSearching = status === "loading" || isPending;

  return (
    <div className="p-0">
      <div className="mb-3">
        <div className="mb-2 flex items-center gap-2">
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-100/90"
          >
            Search for your location
          </label>
          <button
            type="button"
            aria-label="About location search"
            onClick={() => setShowHelp((value) => !value)}
            className="flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-white/3 text-[11px] font-semibold text-sky-100/70 transition hover:border-white/25 hover:bg-white/6 hover:text-sky-50"
          >
            ?
          </button>
        </div>
        {showHelp && (
          <p className="mb-2 text-xs leading-5 text-slate-300/68">
            Search uses the Open-Meteo geocoding service and will suggest places
            as you type.
          </p>
        )}
        <input
          id={inputId}
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
          placeholder="Start typing a city, town, or region"
          className="w-full rounded-full border border-white/12 bg-slate-950/22 px-4 py-3 text-sm text-white/90 outline-none transition placeholder:text-slate-400/85 focus:border-sky-300/45 focus:bg-slate-950/30"
        />
      </div>

      {hasQuery && (
        <div className="min-h-32 rounded-[1.5rem] border border-white/10 bg-slate-950/18 p-3 backdrop-blur-[2px]">
          {isSearching && (
            <p className="text-sm text-sky-100/72">Searching locations...</p>
          )}

          {!isSearching && error && (
            <p className="text-sm text-rose-200/88">{error}</p>
          )}

          {!isSearching && !error && results.length === 0 && (
            <p className="text-sm text-slate-300/68">
              No matches found. Try a nearby city or broader region.
            </p>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((place) => {
                const label = formatPlaceLabel(place);
                return (
                  <button
                    key={`${place.latitude}-${place.longitude}-${place.name}`}
                    type="button"
                    onClick={() => {
                      setQuery(label);
                      setResults([]);
                      onSelect({
                        label,
                        latitude: place.latitude,
                        longitude: place.longitude,
                        tz: place.timezone,
                      });
                    }}
                    className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/3 px-4 py-3 text-left transition hover:border-sky-300/35 hover:bg-sky-300/7"
                  >
                    <span className="text-sm font-medium text-white/90">{label}</span>
                    <span className="text-xs uppercase tracking-[0.24em] text-sky-100/55">
                      Select
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
