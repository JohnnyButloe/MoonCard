"use client";
import { useLunarNow, useMoonToday } from "../hooks/useLunar";

export default function MoonNowCard({
  lat,
  lon,
  tz,
}: {
  lat: number;
  lon: number;
  tz: string;
}) {
  const nowQ = useLunarNow(lat, lon, tz);
  const todayQ = useMoonToday(lat, lon, tz);

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

  const now = nowQ.data!;
  const today = todayQ.data!;

  return (
    <div className="grid gap-4 p-6 rounded-2xl shadow bg-white/5 backdrop-blur">
      <header>
        <h2 className="text-xl font-semibold">Moon now</h2>
        <p className="text-sm opacity-70">{now.whenISO}</p>
      </header>

      <section className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-4xl font-bold">{now.illumPct}%</div>
          <div className="opacity-70">illumination</div>
        </div>
        <div>
          <div className="text-2xl font-semibold">{today.phaseName ?? "—"}</div>
          <div className="opacity-70">phase</div>
        </div>
        <div>
          <div className="text-2xl font-semibold">{now.altDeg.toFixed(1)}°</div>
          <div className="opacity-70">altitude</div>
        </div>
        <div>
          <div className="text-2xl font-semibold">{now.azDeg.toFixed(0)}°</div>
          <div className="opacity-70">azimuth</div>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <div className="opacity-70">Moonrise</div>
          <div>{today.rise ?? "—"}</div>
        </div>
        <div>
          <div className="opacity-70">High moon</div>
          <div>{today.highMoon ?? "—"}</div>
        </div>
        <div>
          <div className="opacity-70">Moonset</div>
          <div>{today.set ?? "—"}</div>
        </div>
        <div>
          <div className="opacity-70">Low moon</div>
          <div>{today.lowMoon ?? "—"}</div>
        </div>
      </section>
    </div>
  );
}
