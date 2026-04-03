"use client";

import { useMoonCard } from "../hooks/useAstronomy";
import { useWeatherNow } from "../hooks/useWeather";
import type { WeatherCondition } from "../providers/weather";
import { MoonPhaseCircle } from "./MoonPhaseCircle";

function formatLocalTime(iso: string | undefined, tz: string): string {
  if (!iso) return "—";

  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
    timeZoneName: "short",
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

function formatTimeOrDateTime(iso: string | undefined, tz: string): string {
  if (!iso) return "—";
  const eventDate = new Date(iso);
  if (!Number.isFinite(eventDate.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  }).format(eventDate);
}

function formatPercent(value: number | null): string {
  return typeof value === "number" ? `${Math.round(value)}%` : "—";
}

function formatDegrees(value: number | null): string {
  return typeof value === "number" ? `${value.toFixed(0)}°` : "—";
}

function toCompass(azDeg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const normalized = ((azDeg % 360) + 360) % 360;
  return dirs[Math.round(normalized / 45) % dirs.length];
}

function formatAzimuthWithDirection(azDeg: number | null): string {
  if (typeof azDeg !== "number") return "—";

  const normalized = Math.round(((azDeg % 360) + 360) % 360);
  return `${toCompass(normalized)} (${normalized}°)`;
}

function weatherLabel(condition: WeatherCondition | undefined): string {
  switch (condition) {
    case "clear":
      return "Clear";
    case "partly_cloudy":
      return "Partly cloudy";
    case "overcast":
      return "Overcast";
    case "rain":
      return "Rain";
    case "snow":
      return "Snow";
    case "storm":
      return "Storm";
    case "fog":
      return "Fog";
    default:
      return "Weather";
  }
}

function WeatherCloudSymbol({
  condition,
  size = 28,
}: {
  condition: WeatherCondition | undefined;
  size?: number;
}) {
  const stroke = "rgba(226,232,240,0.92)";
  const baseCloud = (
    <path
      d="M17 41h30a8.5 8.5 0 0 0 0-17 13.5 13.5 0 0 0-25.8-3.9A9.5 9.5 0 0 0 17 41Z"
      fill="rgba(148,163,184,0.2)"
      stroke={stroke}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );

  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      {condition === "clear" || condition === "partly_cloudy" ? (
        <circle
          cx="46"
          cy="18"
          r="7"
          fill="rgba(250,204,21,0.25)"
          stroke="rgba(250,204,21,0.95)"
          strokeWidth="1.8"
        />
      ) : null}

      {condition === "overcast" ? (
        <path
          d="M12 36h24a7 7 0 0 0 0-14 11 11 0 0 0-20.7-3.4A8 8 0 0 0 12 36Z"
          fill="rgba(148,163,184,0.18)"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {baseCloud}

      {condition === "rain" ? (
        <g stroke="rgba(125,211,252,0.95)" strokeWidth="2.3" strokeLinecap="round">
          <line x1="23" y1="46" x2="20" y2="54" />
          <line x1="33" y1="47" x2="30" y2="56" />
          <line x1="43" y1="46" x2="40" y2="54" />
        </g>
      ) : null}

      {condition === "snow" ? (
        <g fill="rgba(224,242,254,0.95)">
          <circle cx="23" cy="52" r="2" />
          <circle cx="33" cy="54" r="2" />
          <circle cx="43" cy="52" r="2" />
        </g>
      ) : null}

      {condition === "storm" ? (
        <path
          d="M33 45l-6 10h6l-4 8 12-13h-6l5-5z"
          fill="rgba(250,204,21,0.95)"
        />
      ) : null}

      {condition === "fog" ? (
        <g stroke={stroke} strokeWidth="2" strokeLinecap="round" opacity="0.9">
          <line x1="19" y1="48" x2="47" y2="48" />
          <line x1="16" y1="54" x2="44" y2="54" />
        </g>
      ) : null}
    </svg>
  );
}

export default function MoonNowCard({
  lat,
  lon,
  tz,
  label = null,
}: {
  lat: number;
  lon: number;
  tz: string;
  label?: string | null;
}) {
  const summaryQ = useMoonCard(lat, lon, tz, { label });
  const weatherQ = useWeatherNow(lat, lon);

  if (summaryQ.error && !summaryQ.data) {
    return (
      <div className="h-full w-full rounded-2xl p-4 text-red-600 shadow">
        Failed to load lunar data.
      </div>
    );
  }

  if (!summaryQ.data) {
    return <div className="h-full w-full rounded-2xl p-4 shadow">Loading…</div>;
  }

  const summary = summaryQ.data;
  const moon = summary.moon;
  const weatherCondition = weatherQ.data?.condition;
  const weatherCloudCover = weatherQ.data?.cloudCoverPct;
  const weatherTitle = weatherCondition
    ? `${weatherLabel(weatherCondition)}${
        typeof weatherCloudCover === "number"
          ? ` · ${Math.round(weatherCloudCover)}% cloud cover`
          : ""
      }`
    : weatherQ.error
      ? "Weather unavailable"
      : "Loading weather";

  const lastUpdatedLabel =
    summaryQ.dataUpdatedAt > 0
      ? formatLocalTime(new Date(summaryQ.dataUpdatedAt).toISOString(), tz)
      : "—";

  return (
    <div className="flex h-full w-full flex-col gap-4 rounded-2xl bg-slate-950/68 p-4 shadow-xl shadow-black/30 ring-1 ring-white/12 backdrop-blur">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-xl font-semibold">Moon now</h2>
          <p className="text-sm opacity-70">
            {formatLocalDateTime(summary.meta.timestamp_iso, tz)}
          </p>
          <p className="text-[11px] opacity-60">
            Source: {summary.meta.calculation_source}
          </p>
          <p className="text-[11px] opacity-60">
            Updated {lastUpdatedLabel}
            {summaryQ.isFetching ? " · updating" : ""}
          </p>
        </div>

        <div
          className={`shrink-0 rounded-xl border border-white/15 bg-slate-950/40 px-2 py-1 text-center ${
            weatherQ.isFetching ? "opacity-80" : "opacity-100"
          }`}
          title={weatherTitle}
        >
          <WeatherCloudSymbol condition={weatherCondition} size={24} />
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-200/85">
            {weatherLabel(weatherCondition)}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div className="space-y-0.5">
          <div className="text-[2rem] font-bold leading-none">{formatPercent(moon.illumination_percent)}</div>
          <div className="text-sm opacity-70">illumination</div>
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <div className="text-lg font-semibold leading-tight">
              {moon.phase_name ?? "—"}
            </div>
            <MoonPhaseCircle
              illuminationFrac={moon.illumination_fraction ?? undefined}
              phaseAngleDeg={moon.phase_angle_deg ?? undefined}
              size={36}
            />
          </div>
          <div className="text-sm opacity-70">phase</div>
        </div>

        <div className="relative">
          <div className="group inline-flex flex-col">
            <div className="text-lg font-semibold leading-tight">{formatDegrees(moon.altitude_deg)}</div>
            <div className="text-sm opacity-70">Altitude</div>
            <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-white/10 bg-slate-950/90 p-3 text-xs text-slate-100 opacity-0 shadow-lg shadow-black/40 backdrop-blur transition group-hover:opacity-100">
              Altitude relative to the horizon (0° = on the horizon, positive =
              above, negative = below).
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="group inline-flex flex-col">
            <div className="text-lg font-semibold leading-tight">
              {formatAzimuthWithDirection(moon.azimuth_deg)}
            </div>
            <div className="text-sm opacity-70">Azimuth</div>
            <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-white/10 bg-slate-950/90 p-3 text-xs text-slate-100 opacity-0 shadow-lg shadow-black/40 backdrop-blur transition group-hover:opacity-100">
              Azimuth is the Moon’s compass direction along the horizon,
              measured in degrees from true north (0°), moving eastward (90°),
              south (180°), and west (270°).
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2.5 text-sm md:grid-cols-4">
        <div className="space-y-0.5">
          <div className="text-sm font-semibold leading-tight text-slate-100 md:text-base">
            {formatTimeOrDateTime(moon.moonrise ?? undefined, tz)}
          </div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-sky-100/60">
            Moonrise (East)
          </div>
          <div className="text-[11px] leading-snug text-slate-300/70">
            Previous moonrise: —
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-sm font-semibold leading-tight text-slate-100 md:text-base">
            {formatTimeOrDateTime(moon.high_moon ?? undefined, tz)}
          </div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-sky-100/60">
            High moon
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-sm font-semibold leading-tight text-slate-100 md:text-base">
            {formatTimeOrDateTime(moon.moonset ?? undefined, tz)}
          </div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-sky-100/60">
            Moonset (West)
          </div>
          <div className="text-[11px] leading-snug text-slate-300/70">
            Previous moonset: —
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-sm font-semibold leading-tight text-slate-100 md:text-base">
            {formatTimeOrDateTime(moon.low_moon ?? undefined, tz)}
          </div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-sky-100/60">
            Low moon
          </div>
        </div>
      </section>
    </div>
  );
}
