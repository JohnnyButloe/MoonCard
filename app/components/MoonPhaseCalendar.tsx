"use client";

import { useMemo, useState } from "react";
import SunCalc from "suncalc";
import { addDays, startOfWeek } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { MoonPhaseCircle } from "./MoonPhaseCircle";

type MajorPhaseDefinition = {
  key: string;
  label: string;
  shortLabel: string;
  phaseAngleDeg: number;
  illuminationFrac: number;
  waxing: boolean;
};

type CalendarEntry = MajorPhaseDefinition & {
  instant: Date;
  dateKey: string;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const GRID_DAYS = 42;
const SEARCH_STEP_MS = 3 * 60 * 60 * 1000;
const SEARCH_WINDOW_MS = 50 * 24 * 60 * 60 * 1000;
const UPCOMING_PHASE_COUNT = 6;

const MAJOR_PHASES: MajorPhaseDefinition[] = [
  {
    key: "new",
    label: "New Moon",
    shortLabel: "New",
    phaseAngleDeg: 0,
    illuminationFrac: 0,
    waxing: true,
  },
  {
    key: "first-quarter",
    label: "First Quarter",
    shortLabel: "First Q",
    phaseAngleDeg: 90,
    illuminationFrac: 0.5,
    waxing: true,
  },
  {
    key: "full",
    label: "Full Moon",
    shortLabel: "Full",
    phaseAngleDeg: 180,
    illuminationFrac: 1,
    waxing: true,
  },
  {
    key: "last-quarter",
    label: "Last Quarter",
    shortLabel: "Last Q",
    phaseAngleDeg: 270,
    illuminationFrac: 0.5,
    waxing: false,
  },
];

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function getPhaseDefinition(targetIndex: number): MajorPhaseDefinition {
  return MAJOR_PHASES[((targetIndex % 4) + 4) % 4];
}

function getDateKey(date: Date, tz: string) {
  return formatInTimeZone(date, tz, "yyyy-MM-dd");
}

function getUpcomingPhaseEntries(now: Date, tz: string): CalendarEntry[] {
  const initialPhase = SunCalc.getMoonIllumination(now).phase;
  const entries: CalendarEntry[] = [];

  let previousInstant = now;
  let previousPhase = initialPhase;
  let previousUnwrapped = initialPhase;
  let cycleOffset = 0;
  let nextTargetIndex = Math.floor(initialPhase * 4) + 1;

  for (
    let timeMs = now.getTime() + SEARCH_STEP_MS;
    timeMs <= now.getTime() + SEARCH_WINDOW_MS &&
    entries.length < UPCOMING_PHASE_COUNT;
    timeMs += SEARCH_STEP_MS
  ) {
    const currentInstant = new Date(timeMs);
    const currentPhase = SunCalc.getMoonIllumination(currentInstant).phase;

    if (currentPhase < previousPhase - 0.5) {
      cycleOffset += 1;
    }

    const currentUnwrapped = currentPhase + cycleOffset;

    while (
      nextTargetIndex / 4 <= currentUnwrapped &&
      entries.length < UPCOMING_PHASE_COUNT
    ) {
      const targetUnwrapped = nextTargetIndex / 4;
      const span = currentUnwrapped - previousUnwrapped;
      const ratio = span > 0 ? (targetUnwrapped - previousUnwrapped) / span : 1;
      const eventMs =
        previousInstant.getTime() +
        (currentInstant.getTime() - previousInstant.getTime()) * clamp01(ratio);
      const definition = getPhaseDefinition(nextTargetIndex);
      const instant = new Date(eventMs);

      entries.push({
        ...definition,
        instant,
        dateKey: getDateKey(instant, tz),
      });

      nextTargetIndex += 1;
    }

    previousInstant = currentInstant;
    previousPhase = currentPhase;
    previousUnwrapped = currentUnwrapped;
  }

  return entries;
}

export default function MoonPhaseCalendar({ tz }: { tz: string }) {
  const { cells, entries, entriesByDate, rangeLabel, todayKey } = useMemo(() => {
    const now = new Date();
    const zonedNow = toZonedTime(now, tz);
    const gridStart = startOfWeek(zonedNow, { weekStartsOn: 0 });
    const phaseEntries = getUpcomingPhaseEntries(now, tz);
    const entryMap = new Map<string, CalendarEntry[]>();

    for (const entry of phaseEntries) {
      const current = entryMap.get(entry.dateKey) ?? [];
      current.push(entry);
      entryMap.set(entry.dateKey, current);
    }

    return {
      cells: Array.from({ length: GRID_DAYS }, (_, index) =>
        addDays(gridStart, index),
      ),
      entries: phaseEntries,
      entriesByDate: entryMap,
      rangeLabel: `${formatInTimeZone(fromZonedTime(gridStart, tz), tz, "MMM d")} - ${formatInTimeZone(fromZonedTime(addDays(gridStart, GRID_DAYS - 1), tz), tz, "MMM d")}`,
      todayKey: getDateKey(now, tz),
    };
  }, [tz]);
  const [selectedPhaseKey, setSelectedPhaseKey] = useState<string | null>(null);
  const selectedEntry = selectedPhaseKey
    ? entries.find(
        (entry) => `${entry.key}-${entry.instant.toISOString()}` === selectedPhaseKey,
      ) ?? null
    : null;

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <h3 className="text-xs uppercase tracking-[0.3em] text-sky-200/60">
            Moon calendar
          </h3>
          <p className="mt-1 text-sm text-slate-200/80">
            Next 6 weeks of major phases
          </p>
        </div>
        <p className="text-[11px] text-slate-300/65">{rangeLabel}</p>
      </div>

      <div className="grid grid-cols-7 gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-400/80">
        {DAY_LABELS.map((label) => (
          <div key={label} className="px-2">
            {label}
          </div>
        ))}
      </div>

      <div className="mt-2 grid flex-1 grid-cols-7 gap-2">
        {cells.map((cell) => {
          const cellInstant = fromZonedTime(cell, tz);
          const cellKey = getDateKey(cellInstant, tz);
          const dayNumber = formatInTimeZone(cellInstant, tz, "d");
          const monthLabel = formatInTimeZone(cellInstant, tz, "MMM");
          const isToday = cellKey === todayKey;
          const isPast = cellKey < todayKey;
          const entriesForDay = entriesByDate.get(cellKey) ?? [];
          const primaryEntry = entriesForDay[0];

          return (
            <div
              key={cellKey}
              className={`flex min-h-[3.35rem] flex-col rounded-xl border px-2 py-1.5 transition ${
                primaryEntry
                  ? "border-sky-300/35 bg-sky-400/10 shadow-[0_0_0_1px_rgba(125,211,252,0.05)]"
                  : "border-white/8 bg-slate-950/35"
              } ${isToday ? "ring-1 ring-sky-300/55" : ""} ${isPast ? "opacity-55" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold text-slate-100">{dayNumber}</div>
                {dayNumber === "1" ? (
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400/75">
                    {monthLabel}
                  </div>
                ) : null}
              </div>

              {primaryEntry ? (
                <button
                  type="button"
                  className={`mt-1 flex min-h-0 flex-1 items-center justify-center rounded-md transition hover:bg-white/8 focus:outline-none focus:ring-1 focus:ring-sky-300/60 ${
                    selectedPhaseKey === `${primaryEntry.key}-${primaryEntry.instant.toISOString()}`
                      ? "bg-white/8"
                      : ""
                  }`}
                  onClick={() => {
                    const entryKey = `${primaryEntry.key}-${primaryEntry.instant.toISOString()}`;
                    setSelectedPhaseKey((current) =>
                      current === entryKey ? null : entryKey,
                    );
                  }}
                  aria-label={`${primaryEntry.label} on ${formatInTimeZone(primaryEntry.instant, tz, "MMMM d")} at ${formatInTimeZone(primaryEntry.instant, tz, "h:mm a")}`}
                >
                  <MoonPhaseCircle
                    className="shrink-0"
                    size={18}
                    illuminationFrac={primaryEntry.illuminationFrac}
                    waxing={primaryEntry.waxing}
                    phaseAngleDeg={primaryEntry.phaseAngleDeg}
                  />
                </button>
              ) : (
                <div className="mt-1 flex-1 rounded-lg border border-dashed border-white/6" />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 min-h-[3.5rem] rounded-xl border border-white/8 bg-slate-950/45 px-3 py-2">
        {selectedEntry ? (
          <div className="flex items-center gap-3">
            <MoonPhaseCircle
              size={20}
              illuminationFrac={selectedEntry.illuminationFrac}
              waxing={selectedEntry.waxing}
              phaseAngleDeg={selectedEntry.phaseAngleDeg}
            />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-100">
                {selectedEntry.label}
              </div>
              <div className="text-xs text-slate-300/65">
                {formatInTimeZone(selectedEntry.instant, tz, "MMM d · h:mm a")}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center text-xs text-slate-300/60">
            Click a moon phase to see its time.
          </div>
        )}
      </div>
    </section>
  );
}
