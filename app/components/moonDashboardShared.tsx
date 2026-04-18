"use client";

import type { WeatherCondition } from "../providers/weather";

export const DASHBOARD_PANEL_CLASS =
  "flex h-full w-full flex-col gap-3 rounded-[1.5rem] bg-slate-950/72 p-4 shadow-lg shadow-black/25 ring-1 ring-white/10 backdrop-blur";

export const DASHBOARD_PANEL_HEADER_CLASS =
  "flex items-start justify-between gap-3";

export const DASHBOARD_PANEL_EYEBROW_CLASS =
  "text-[10px] uppercase tracking-[0.24em] text-sky-200/50";

export const DASHBOARD_PANEL_TITLE_CLASS =
  "mt-1 text-sm font-semibold tracking-tight text-slate-50";

export const DASHBOARD_SURFACE_CLASS =
  "rounded-[1.1rem] border border-white/8 bg-white/[0.03] px-3.5 py-3";

export const DASHBOARD_METRIC_LABEL_CLASS =
  "text-[10px] uppercase tracking-[0.18em] text-slate-300/60";

export const DASHBOARD_SUPPORT_TEXT_CLASS =
  "mt-1 text-[11px] leading-relaxed text-slate-300/70";

export const DASHBOARD_META_FOOTER_CLASS =
  "mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-white/8 pt-2.5 text-[10px] text-slate-400/68";

export function formatLocalTime(iso: string | undefined, tz: string): string {
  if (!iso) return "—";

  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
    timeZoneName: "short",
  }).format(d);
}

export function formatLocalDate(iso: string | undefined, tz: string): string {
  if (!iso) return "—";

  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: tz,
  }).format(d);
}

export function formatTimeOrDateTime(iso: string | undefined, tz: string): string {
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

export function weatherLabel(condition: WeatherCondition | undefined): string {
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

export function WeatherCloudSymbol({
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
