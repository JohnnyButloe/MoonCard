"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getBrowserLocation, formatGeoError } from "../lib/location";
import { reverseGeocode } from "../lib/reverseGeocode";

export type LocationSource = "current" | "home" | "saved" | "fallback";

export type CachedLocation = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  tz?: string;
  source: LocationSource;
};

export type StoredLocation = {
  id?: string;
  label: string;
  latitude: number;
  longitude: number;
  tz?: string;
};

type LocationContextValue = {
  active: CachedLocation;
  activeId: string;
  current: CachedLocation | null;
  home: CachedLocation | null;
  saved: CachedLocation[];
  tz: string;
  isLocating: boolean;
  hasCompletedOnboarding: boolean;
  setActiveById: (id: string) => void;
  setHomeFromCurrent: () => void;
  saveCurrentToList: () => void;
  addSavedLocation: (loc: StoredLocation) => void;
  selectLocation: (loc: StoredLocation) => void;
  removeSavedLocation: (id: string) => void;
  renameSavedLocation: (id: string, label: string) => void;
};

const LocationContext = createContext<LocationContextValue | null>(null);

const STORAGE_LAST_LOCATION = "mooncard:lastLocation";
const STORAGE_HOME_LOCATION = "mooncard:homeLocation";
const STORAGE_SAVED_LOCATIONS = "mooncard:savedLocations";
const STORAGE_ACTIVE_ID = "mooncard:activeLocationId";
const STORAGE_HAS_SELECTED_LOCATION = "mooncard:hasSelectedLocation";
const MAX_SAVED = 8;

function readStoredLocation(key: string): StoredLocation | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLocation;
    if (
      typeof parsed?.latitude === "number" &&
      typeof parsed?.longitude === "number" &&
      typeof parsed?.label === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeStoredLocation(key: string, loc: StoredLocation) {
  try {
    localStorage.setItem(key, JSON.stringify(loc));
  } catch {
    // ignore write failures (privacy mode, storage disabled, etc.)
  }
}

function readSavedLocations(): StoredLocation[] {
  try {
    const raw = localStorage.getItem(STORAGE_SAVED_LOCATIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (loc) =>
        loc &&
        typeof loc.label === "string" &&
        typeof loc.latitude === "number" &&
        typeof loc.longitude === "number",
    );
  } catch {
    return [];
  }
}

function writeSavedLocations(locs: StoredLocation[]) {
  try {
    localStorage.setItem(STORAGE_SAVED_LOCATIONS, JSON.stringify(locs));
  } catch {
    // ignore write failures
  }
}

function toCachedLocation(
  source: LocationSource,
  stored: StoredLocation,
  tzFallback: string,
  idOverride?: string,
): CachedLocation {
  return {
    id:
      idOverride ??
      stored.id ??
      `${source}-${stored.latitude}-${stored.longitude}`,
    label: stored.label,
    latitude: stored.latitude,
    longitude: stored.longitude,
    tz: stored.tz ?? tzFallback,
    source,
  };
}

export function LocationProvider({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback: CachedLocation;
}) {
  const didInit = useRef(false);
  const [active, setActive] = useState<CachedLocation>(fallback);
  const [activeId, setActiveId] = useState<string>(fallback.id);
  const activeIdRef = useRef<string>(fallback.id);
  const [current, setCurrent] = useState<CachedLocation | null>(null);
  const [home, setHome] = useState<CachedLocation | null>(null);
  const [saved, setSaved] = useState<CachedLocation[]>([]);
  const [tz, setTz] = useState<string>(fallback.tz ?? "UTC");
  const [isLocating, setIsLocating] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const commitActiveSelection = useCallback(
    (next: CachedLocation, id: string) => {
      activeIdRef.current = id;
      setActive(next);
      setActiveId(id);
      setTz(next.tz ?? tz);
      try {
        localStorage.setItem(STORAGE_ACTIVE_ID, id);
      } catch {
        // ignore
      }
    },
    [tz],
  );

  const setActiveById = (id: string) => {
    let next: CachedLocation | null = null;
    if (id === "current") next = current;
    else if (id === "home") next = home;
    else next = saved.find((loc) => loc.id === id) ?? null;
    if (!next) return;
    commitActiveSelection(next, id);
  };

  const setHomeFromCurrent = () => {
    if (!current) return;
    const nextHome: StoredLocation = {
      label: current.label,
      latitude: current.latitude,
      longitude: current.longitude,
      tz: current.tz,
    };
    writeStoredLocation(STORAGE_HOME_LOCATION, nextHome);
    const homeLoc = toCachedLocation("home", nextHome, tz, "home");
    setHome(homeLoc);
    if (activeId === "home") {
      setActive(homeLoc);
      setTz(homeLoc.tz ?? tz);
    }
  };

  const saveCurrentToList = () => {
    if (!current) return;
    const existing = saved.find(
      (loc) =>
        Math.abs(loc.latitude - current.latitude) < 0.0001 &&
        Math.abs(loc.longitude - current.longitude) < 0.0001,
    );
    if (existing) {
      setActiveById(existing.id);
      return;
    }
    const entry: StoredLocation = {
      id: `saved-${Date.now()}`,
      label: current.label,
      latitude: current.latitude,
      longitude: current.longitude,
      tz: current.tz,
    };
    const nextStored = [entry, ...saved.map((loc) => ({ ...loc }))].slice(
      0,
      MAX_SAVED,
    );
    const nextSaved = nextStored.map((loc) =>
      toCachedLocation("saved", loc, tz),
    );
    const nextActive = toCachedLocation("saved", entry, tz);
    setSaved(nextSaved);
    writeSavedLocations(nextStored);
    commitActiveSelection(nextActive, nextActive.id);
  };

  const addSavedLocation = (loc: StoredLocation) => {
    const match = saved.find(
      (item) =>
        Math.abs(item.latitude - loc.latitude) < 0.0001 &&
        Math.abs(item.longitude - loc.longitude) < 0.0001,
    );
    if (match) {
      commitActiveSelection(match, match.id);
      return;
    }
    const entry: StoredLocation = {
      id: `saved-${Date.now()}`,
      label: loc.label,
      latitude: loc.latitude,
      longitude: loc.longitude,
      tz: loc.tz,
    };
    const nextStored = [entry, ...saved.map((item) => ({ ...item }))].slice(
      0,
      MAX_SAVED,
    );
    const nextSaved = nextStored.map((item) =>
      toCachedLocation("saved", item, tz),
    );
    const nextActive = toCachedLocation("saved", entry, tz);
    setSaved(nextSaved);
    writeSavedLocations(nextStored);
    commitActiveSelection(nextActive, nextActive.id);
  };

  const selectLocation = (loc: StoredLocation) => {
    addSavedLocation(loc);
    setHasCompletedOnboarding(true);
    try {
      localStorage.setItem(STORAGE_HAS_SELECTED_LOCATION, "true");
    } catch {
      // ignore
    }
  };

  const removeSavedLocation = (id: string) => {
    const nextSaved = saved.filter((loc) => loc.id !== id);
    setSaved(nextSaved);
    writeSavedLocations(nextSaved.map((loc) => ({ ...loc })));

    if (activeId === id) {
      const fallbackNext = current ?? home ?? nextSaved[0] ?? fallback;
      commitActiveSelection(fallbackNext, fallbackNext.id);
    }
  };

  const renameSavedLocation = (id: string, label: string) => {
    const nextSaved = saved.map((loc) =>
      loc.id === id ? { ...loc, label } : loc,
    );
    setSaved(nextSaved);
    writeSavedLocations(nextSaved.map((loc) => ({ ...loc })));
    if (activeId === id) {
      setActive((prev) => ({ ...prev, label }));
    }
  };

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    (async () => {
      const tzClient =
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        (fallback.tz ?? "UTC");

      setTz(fallback.tz ?? tzClient);

      const storedHome = readStoredLocation(STORAGE_HOME_LOCATION);
      const homeLoc = storedHome
        ? toCachedLocation("home", storedHome, tzClient, "home")
        : null;
      setHome(homeLoc);

      const storedSaved = readSavedLocations()
        .slice(0, MAX_SAVED)
        .map((loc) => toCachedLocation("saved", loc, tzClient));
      setSaved(storedSaved);

      const cached = readStoredLocation(STORAGE_LAST_LOCATION);
      const currentLoc = cached
        ? toCachedLocation("current", cached, tzClient, "current")
        : null;
      setCurrent(currentLoc);

      let storedActiveId: string | null = null;
      try {
        storedActiveId = localStorage.getItem(STORAGE_ACTIVE_ID);
      } catch {
        storedActiveId = null;
      }

      let onboardingComplete = false;
      try {
        onboardingComplete =
          localStorage.getItem(STORAGE_HAS_SELECTED_LOCATION) === "true";
      } catch {
        onboardingComplete = false;
      }

      if (!onboardingComplete) {
        onboardingComplete = Boolean(
          homeLoc ||
            storedSaved.length > 0 ||
            (storedActiveId === "current" && currentLoc),
        );
      }
      setHasCompletedOnboarding(onboardingComplete);
      if (onboardingComplete) {
        try {
          localStorage.setItem(STORAGE_HAS_SELECTED_LOCATION, "true");
        } catch {
          // ignore
        }
      }

      let initialActive: CachedLocation = fallback;
      let initialActiveId = fallback.id;
      try {
        if (storedActiveId === "current" && currentLoc) {
          initialActive = currentLoc;
          initialActiveId = "current";
        } else if (storedActiveId === "home" && homeLoc) {
          initialActive = homeLoc;
          initialActiveId = "home";
        } else {
          const savedMatch = storedSaved.find(
            (loc) => loc.id === storedActiveId,
          );
          if (savedMatch) {
            initialActive = savedMatch;
            initialActiveId = savedMatch.id;
          } else if (currentLoc) {
            initialActive = currentLoc;
            initialActiveId = "current";
          } else if (homeLoc) {
            initialActive = homeLoc;
            initialActiveId = "home";
          }
        }
      } catch {
        // ignore
      }
      activeIdRef.current = initialActiveId;
      setActive(initialActive);
      setActiveId(initialActiveId);
      setTz(initialActive.tz ?? tzClient);

      setIsLocating(true);
      const res = await getBrowserLocation({
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 60_000,
      });
      setIsLocating(false);

      if (!res.ok) {
        console.warn(formatGeoError(res.error));
        return;
      }

      const { latitude, longitude } = res.location;
      const nextStored: StoredLocation = {
        label: "Current location",
        latitude,
        longitude,
        tz: tzClient,
      };
      const next: CachedLocation = toCachedLocation(
        "current",
        nextStored,
        tzClient,
        "current",
      );

      setCurrent(next);
      writeStoredLocation(STORAGE_LAST_LOCATION, nextStored);
      if (activeIdRef.current === "current") {
        commitActiveSelection(next, "current");
      }

      const rg = await reverseGeocode(latitude, longitude, {
        localityLanguage: "en",
        timeoutMs: 4000,
      });

      if (rg?.label) {
        const updatedStored: StoredLocation = {
          label: rg.label,
          latitude,
          longitude,
          tz: tzClient,
        };
        const updated = toCachedLocation(
          "current",
          updatedStored,
          tzClient,
          "current",
        );
        setCurrent(updated);
        writeStoredLocation(STORAGE_LAST_LOCATION, updatedStored);
        setActive((prev) => (prev.id === "current" ? { ...updated } : prev));
        if (activeIdRef.current === "current") {
          setTz(updated.tz ?? tzClient);
        }
      }
    })();
  }, [commitActiveSelection, fallback]);

  return (
    <LocationContext.Provider
      value={{
        active,
        activeId,
        current,
        home,
        saved,
        tz,
        isLocating,
        hasCompletedOnboarding,
        setActiveById,
        setHomeFromCurrent,
        saveCurrentToList,
        addSavedLocation,
        selectLocation,
        removeSavedLocation,
        renameSavedLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error("useLocation must be used within LocationProvider");
  }
  return ctx;
}
