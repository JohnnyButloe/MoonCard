"use client";
import { useLunarNow, useMoonToday } from "../hooks/useLunar";

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

  return (
    <div className="grid gap-4 p-6 rounded-2xl shadow bg-white/5 backdrop-blur">
      <header>
        <h2 className="text-xl font-semibold">Moon now</h2>
        {/* Display the local timestamp from the now hook */}
        <p className="text-sm opacity-70">
          {formatLocalDateTime(now.whenISO, tz)}
        </p>
        <span className="font-semibold">internal:</span> python_service ·{" "}
        <span className="font-semibold">external:</span> SunCalc
      </header>

      {/* Current illumination, phase, altitude and azimuth */}
      <section className="grid grid-cols-2 gap-4">
        {/* Illumination */}
        <div>
          <div className="text-4xl font-bold">
            {now.internal.illumPct}% / {now.external.illumPct}%
          </div>
          <div className="opacity-70">illumination</div>
          <div className="mt-1 text-xs opacity-60"></div>
        </div>

        {/* Phase */}
        <div>
          <div className="text-2xl font-semibold">
            {today.internal.phaseName ?? "—"} /{" "}
            {today.external.phaseName ?? "—"}
          </div>
          <div className="opacity-70">phase</div>
          <div className="mt-1 text-xs opacity-60"></div>
        </div>

        {/* Altitude */}
        <div>
          <div className="text-2xl font-semibold">
            {now.internal.altDeg.toFixed(1)}° / {now.external.altDeg.toFixed(1)}
            °
          </div>
          <div className="opacity-70">altitude</div>
          <div className="mt-1 text-xs opacity-60"></div>
        </div>

        {/* Azimuth */}
        <div>
          <div className="text-2xl font-semibold">
            {now.internal.azDeg.toFixed(0)}° / {now.external.azDeg.toFixed(0)}°
          </div>
          <div className="opacity-70">azimuth</div>
          <div className="mt-1 text-xs opacity-60"></div>
        </div>
      </section>

      {/* Daily events: rise, high, set, low */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        {/* Moonrise */}
        <div>
          <div className="opacity-70">Moonrise</div>
          <div>
            {formatLocalDateTime(today.internal.rise, tz)} /{" "}
            {formatLocalDateTime(today.external.rise, tz)}
          </div>
          <div className="mt-1 text-xs opacity-60">
            <span className="font-semibold">internal:</span> python_service ·{" "}
            <span className="font-semibold">external:</span> SunCalc
          </div>
        </div>

        {/* High moon */}
        <div>
          <div className="opacity-70">High moon</div>
          <div>
            {formatLocalDateTime(today.internal.highMoon, tz)} /{" "}
            {formatLocalDateTime(today.external.highMoon, tz)}
          </div>
          <div className="mt-1 text-xs opacity-60">
            <span className="font-semibold">internal:</span> python_service ·{" "}
            <span className="font-semibold">external:</span> SunCalc
          </div>
        </div>

        {/* Moonset */}
        <div>
          <div className="opacity-70">Moonset</div>
          <div>
            {formatLocalDateTime(today.internal.set, tz)} /{" "}
            {formatLocalDateTime(today.external.set, tz)}
          </div>
          <div className="mt-1 text-xs opacity-60">
            <span className="font-semibold">internal:</span> python_service ·{" "}
            <span className="font-semibold">external:</span> SunCalc
          </div>
        </div>

        {/* Low moon */}
        <div>
          <div className="opacity-70">Low moon</div>
          <div>
            {formatLocalDateTime(today.internal.lowMoon, tz)} /{" "}
            {formatLocalDateTime(today.external.lowMoon, tz)}
          </div>
          <div className="mt-1 text-xs opacity-60">
            <span className="font-semibold">internal:</span> python_service ·{" "}
            <span className="font-semibold">external:</span> SunCalc
          </div>
        </div>
      </section>
    </div>
  );
}
