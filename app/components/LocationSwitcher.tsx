"use client";

import { useState } from "react";
import { useLocation } from "../providers/LocationProvider";
import { US_CITIES } from "../lib/usCities";

function PillButton({
  active,
  disabled,
  label,
  onClick,
  title,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        active
          ? "border-sky-200/60 bg-sky-400/20 text-sky-100"
          : "border-white/10 bg-white/5 text-sky-100/70 hover:border-white/20 hover:text-sky-100"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      {label}
    </button>
  );
}

export default function LocationSwitcher() {
  const {
    activeId,
    current,
    home,
    saved,
    isLocating,
    setActiveById,
    setHomeFromCurrent,
    saveCurrentToList,
    addSavedLocation,
    removeSavedLocation,
    renameSavedLocation,
  } = useLocation();
  const [cityId, setCityId] = useState("");
  const activeSaved = saved.find((loc) => loc.id === activeId) ?? null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
      <div className="flex flex-wrap items-center gap-2">
        <PillButton
          label={isLocating ? "Locating…" : "Current"}
          active={activeId === "current"}
          disabled={!current}
          onClick={() => setActiveById("current")}
        />
        <PillButton
          label="Home"
          active={activeId === "home"}
          disabled={!home}
          onClick={() => setActiveById("home")}
        />
        {saved.map((loc) => (
          <PillButton
            key={loc.id}
            label={
              loc.label.length > 16 ? `${loc.label.slice(0, 16)}…` : loc.label
            }
            active={activeId === loc.id}
            onClick={() => setActiveById(loc.id)}
            title={loc.label}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <select
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-sky-100/80 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
          value={cityId}
          onChange={(event) => {
            const nextId = event.target.value;
            setCityId(nextId);
            const city = US_CITIES.find((c) => c.id === nextId);
            if (!city) return;
            addSavedLocation({
              label: city.label,
              latitude: city.latitude,
              longitude: city.longitude,
              tz: city.tz,
            });
            setCityId("");
          }}
        >
          <option value="">Add a city…</option>
          {US_CITIES.map((city) => (
            <option key={city.id} value={city.id}>
              {city.label}
            </option>
          ))}
        </select>
        <PillButton
          label="Set Home"
          disabled={!current}
          onClick={setHomeFromCurrent}
          title="Save current location as Home"
        />
        <PillButton
          label="Save Current"
          disabled={!current}
          onClick={saveCurrentToList}
          title="Add current location to saved list"
        />
        <PillButton
          label="Rename"
          disabled={!activeSaved}
          onClick={() => {
            if (!activeSaved) return;
            const next = window.prompt(
              "Edit saved location label",
              activeSaved.label,
            );
            if (!next) return;
            const trimmed = next.trim();
            if (!trimmed) return;
            renameSavedLocation(activeSaved.id, trimmed);
          }}
          title="Edit label for the selected saved location"
        />
        <PillButton
          label="Remove"
          disabled={!activeSaved}
          onClick={() => {
            if (!activeSaved) return;
            const ok = window.confirm(
              `Remove "${activeSaved.label}" from saved locations?`,
            );
            if (!ok) return;
            removeSavedLocation(activeSaved.id);
          }}
          title="Remove the selected saved location"
        />
      </div>
    </div>
  );
}
