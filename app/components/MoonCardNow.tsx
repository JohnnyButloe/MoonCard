"use client";
import { useLunarNow, useMoonToday } from "../hooks/useLunar";
import { MoonPhaseCircle } from "./MoonPhaseCircle";

function formatLocalTime(iso: string | undefined, tz: string): string {
  if (!iso) return "—";

  const d = new Date(iso);

  // Example output: "9:09 AM EST" / "9:09 AM PDT"
  // MDN: Intl.DateTimeFormat with timeStyle + timeZoneName formats nice local times. :contentReference[oaicite:3]{index=3}
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
    timeZoneName: "short", // EST / EDT, etc.
  }).format(d);
}

function formatLocalDateTime(iso: string | undefined, tz: string): string {
  if (!iso) return "—";

  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
    timeZoneName: "short",
  }).format(d);
}

function dayKeyInTimeZone(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).format(date);
}

function formatTimeOrDateTime(
  iso: string | undefined,
  tz: string,
  referenceIso: string | undefined,
): string {
  if (!iso) return "—";
  const eventDate = new Date(iso);
  if (!Number.isFinite(eventDate.getTime())) return "—";

  const referenceDate = referenceIso ? new Date(referenceIso) : new Date();
  const sameDay =
    Number.isFinite(referenceDate.getTime()) &&
    dayKeyInTimeZone(eventDate, tz) === dayKeyInTimeZone(referenceDate, tz);

  if (sameDay) {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz,
    }).format(eventDate);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  }).format(eventDate);
}

function toCompass(azDeg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const normalized = ((azDeg % 360) + 360) % 360;
  return dirs[Math.round(normalized / 45) % dirs.length];
}

function formatAzimuthWithDirection(azDeg: number): string {
  const normalized = Math.round(((azDeg % 360) + 360) % 360);
  return `${toCompass(normalized)} (${normalized}°)`;
}

/**
 * MoonNowCard displays current lunar information and today's lunar events.
 * It now supports comparison between the internal Python ephemeris service
 * and external SunCalc/MET data. Values from the internal source are
 * displayed first, followed by a slash and the external value.
 */
export default function MoonNowCard({
  lat,
  lon,
  tz,
}: {
  lat: number;
  lon: number;
  tz: string;
}) {
  // Fetch the “now” and “today” queries. Each returns internal and external
  // results via our updated hooks.
  const nowQ = useLunarNow(lat, lon, tz);
  const todayQ = useMoonToday(lat, lon, tz);

  // Render loading and error states.
  if (nowQ.isLoading || todayQ.isLoading || !nowQ.data || !todayQ.data) {
    return <div className="p-6 rounded-2xl shadow">Loading…</div>;
  }

  if (nowQ.error || todayQ.error) {
    return (
      <div className="p-6 rounded-2xl shadow text-red-600">
        Failed to load lunar data.
      </div>
    );
  }

  // Safe to access the data now (non-null because of guards above)
  const now = nowQ.data!;
  const today = todayQ.data!;

  // Use internal illumination as primary source for phase visual,
  // falling back to the external value if needed.
  const phaseIllumPct = now.internal.illumPct ?? now.external.illumPct;
  const lastUpdatedMs = Math.max(
    nowQ.dataUpdatedAt ?? 0,
    todayQ.dataUpdatedAt ?? 0,
  );
  const lastUpdatedLabel =
    lastUpdatedMs > 0
      ? formatLocalTime(new Date(lastUpdatedMs).toISOString(), tz)
      : "—";
  const isUpdating = nowQ.isFetching || todayQ.isFetching;

  return (
    <div className="grid gap-4 rounded-2xl bg-white/5 p-6 shadow-xl shadow-black/20 ring-1 ring-white/10 backdrop-blur">
      <header>
        <h2 className="text-xl font-semibold">Moon now</h2>
        {/* Display the local timestamp from the now hook */}
        <p className="text-sm opacity-70">
          {formatLocalDateTime(now.whenISO, tz)}
        </p>
        <p className="text-xs opacity-60">
          <span className="font-semibold">internal:</span> python_service ·{" "}
          <span className="font-semibold">external:</span> SunCalc
        </p>
        <p className="text-xs opacity-60">
          Updated {lastUpdatedLabel}
          {isUpdating ? " · updating" : ""}
        </p>
      </header>

      {/* Current illumination, phase, altitude and azimuth */}
      <section className="grid grid-cols-2 gap-4">
        {/* Phase */}
        <div>
          <div className="text-4xl font-bold">
            {now.internal.illumPct}% / {now.external.illumPct}%
          </div>
          <div className="opacity-70">illumination</div>
          <div className="mt-1 text-xs opacity-60"></div>
        </div>
        <div>
          <div className="flex items-center gap-4">
            <div className="text-2xl font-semibold">
              {today.internal.phaseName ?? today.external.phaseName ?? "-"}
            </div>
            <MoonPhaseCircle illuminationPct={phaseIllumPct} />
          </div>
          <div className="opacity-70">phase</div>
        </div>
        {/* Altitude */}
        <div className="relative">
          <div className="group inline-flex flex-col">
            <div className="text-2xl font-semibold">
              {now.internal.altDeg.toFixed(0)}° /{" "}
              {now.external.altDeg.toFixed(0)}°
            </div>
            <div className="opacity-70">Altitude</div>
            <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-white/10 bg-slate-950/90 p-3 text-xs text-slate-100 opacity-0 shadow-lg shadow-black/40 backdrop-blur transition group-hover:opacity-100">
              Altitude relative to the horizon (0° = on the horizon, positive =
              above, negative = below).
            </div>
          </div>
          <div className="mt-1 text-xs opacity-60"></div>
        </div>

        {/* Azimuth */}
        <div className="relative">
          <div className="group inline-flex flex-col">
            <div className="text-2xl font-semibold">
              {formatAzimuthWithDirection(now.internal.azDeg)} /{" "}
              {formatAzimuthWithDirection(now.external.azDeg)}
            </div>
            <div className="opacity-70">Azimuth</div>
            <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-white/10 bg-slate-950/90 p-3 text-xs text-slate-100 opacity-0 shadow-lg shadow-black/40 backdrop-blur transition group-hover:opacity-100">
              Azimuth is the Moon’s compass direction along the horizon,
              measured in degrees from true north (0°), moving eastward (90°),
              south (180°), and west (270°).
            </div>
          </div>
          <div className="mt-1 text-xs opacity-60"></div>
        </div>
      </section>

      {/* Daily events: rise, high, set, low */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        {/* Moonrise */}
        <div>
          <div className="mt-1 text-lg font-semibold leading-tight text-slate-100">
            {formatTimeOrDateTime(today.internal.rise, tz, now.whenISO)} /{" "}
            {formatTimeOrDateTime(today.external.rise, tz, now.whenISO)}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.2em] text-sky-100/60">
            Moonrise (East)
          </div>
          <div className="mt-1 text-xs text-slate-300/70">
            Previous moonrise:{" "}
            {formatTimeOrDateTime(today.internal.prevRise, tz, now.whenISO)} /{" "}
            {formatTimeOrDateTime(today.external.prevRise, tz, now.whenISO)}
          </div>
          <div className="mt-1 text-xs text-slate-300/60">
            <span className="font-semibold">internal:</span> python_service ·{" "}
            <span className="font-semibold">external:</span> SunCalc
          </div>
        </div>

        {/* High moon */}
        <div>
          <div className="mt-1 text-lg font-semibold leading-tight text-slate-100">
            {formatTimeOrDateTime(today.internal.highMoon, tz, now.whenISO)} /{" "}
            {formatTimeOrDateTime(today.external.highMoon, tz, now.whenISO)}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.2em] text-sky-100/60">
            High moon
          </div>
        </div>

        {/* Moonset */}
        <div>
          <div className="mt-1 text-lg font-semibold leading-tight text-slate-100">
            {formatTimeOrDateTime(today.internal.set, tz, now.whenISO)} /{" "}
            {formatTimeOrDateTime(today.external.set, tz, now.whenISO)}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.2em] text-sky-100/60">
            Moonset (West)
          </div>
          <div className="mt-1 text-xs text-slate-300/70">
            Previous moonset:{" "}
            {formatTimeOrDateTime(today.internal.prevSet, tz, now.whenISO)} /{" "}
            {formatTimeOrDateTime(today.external.prevSet, tz, now.whenISO)}
          </div>
          <div className="mt-1 text-xs text-slate-300/60">
            <span className="font-semibold">internal:</span> python_service ·{" "}
            <span className="font-semibold">external:</span> SunCalc
          </div>
        </div>

        {/* Low moon */}
        <div>
          <div className="mt-1 text-lg font-semibold leading-tight text-slate-100">
            {formatTimeOrDateTime(today.internal.lowMoon, tz, now.whenISO)} /{" "}
            {formatTimeOrDateTime(today.external.lowMoon, tz, now.whenISO)}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.2em] text-sky-100/60">
            Low moon
          </div>
        </div>
      </section>
    </div>
  );
}
