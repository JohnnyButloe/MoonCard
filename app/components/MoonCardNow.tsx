"use client";
import { useLunarNow, useMoonToday } from "../hooks/useLunar";

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
  if (nowQ.isLoading || todayQ.isLoading) {
    return <div className="p-6 rounded-2xl shadow">Loading…</div>;
  }
  if (nowQ.error || todayQ.error) {
    return (
      <div className="p-6 rounded-2xl shadow text-red-600">
        Failed to load lunar data.
      </div>
    );
  }

  // Safe to access the data now
  const now = nowQ.data!;
  const today = todayQ.data!;

  return (
    <div className="grid gap-4 p-6 rounded-2xl shadow bg-white/5 backdrop-blur">
      <header>
        <h2 className="text-xl font-semibold">Moon now</h2>
        {/* Display the local timestamp from the now hook */}
        <p className="text-sm opacity-70">{now.whenISO}</p>
      </header>

      {/* Current illumination, phase, altitude and azimuth */}
      <section className="grid grid-cols-2 gap-4">
        <div>
          {/* Illumination: internal % / external % */}
          <div className="text-4xl font-bold">
            {now.internal.illumPct}% / {now.external.illumPct}%
          </div>
          <div className="opacity-70">illumination</div>
        </div>
        <div>
          {/* Phase name: internal name / external name */}
          <div className="text-2xl font-semibold">
            {today.internal.phaseName ?? "—"} /{" "}
            {today.external.phaseName ?? "—"}
          </div>
          <div className="opacity-70">phase</div>
        </div>
        <div>
          {/* Altitude: internal vs external */}
          <div className="text-2xl font-semibold">
            {now.internal.altDeg.toFixed(1)}° / {now.external.altDeg.toFixed(1)}
            °
          </div>
          <div className="opacity-70">altitude</div>
        </div>
        <div>
          {/* Azimuth: internal vs external */}
          <div className="text-2xl font-semibold">
            {now.internal.azDeg.toFixed(0)}° / {now.external.azDeg.toFixed(0)}°
          </div>
          <div className="opacity-70">azimuth</div>
        </div>
      </section>

      {/* Daily events: rise, high, set, low */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <div className="opacity-70">Moonrise</div>
          <div>
            {today.internal.rise ?? "—"} / {today.external.rise ?? "—"}
          </div>
        </div>
        <div>
          <div className="opacity-70">High moon</div>
          <div>
            {today.internal.highMoon ?? "—"} / {today.external.highMoon ?? "—"}
          </div>
        </div>
        <div>
          <div className="opacity-70">Moonset</div>
          <div>
            {today.internal.set ?? "—"} / {today.external.set ?? "—"}
          </div>
        </div>
        <div>
          <div className="opacity-70">Low moon</div>
          <div>
            {today.internal.lowMoon ?? "—"} / {today.external.lowMoon ?? "—"}
          </div>
        </div>
      </section>
    </div>
  );
}
