"use client";

import { useMoonCard } from "../hooks/useAstronomy";
import { formatLocalTime } from "./moonDashboardShared";

type Props = {
  label: string;
  latitude?: number;
  longitude?: number;
  tz?: string;
  source: "current" | "home" | "saved" | "fallback";
  onClick?: () => void;
};

function sourceLabel(source: Props["source"]) {
  switch (source) {
    case "current":
      return "Current";
    case "home":
      return "Home";
    case "saved":
      return "Saved";
    default:
      return "Default";
  }
}

export default function LocationTag({
  label,
  latitude,
  longitude,
  tz,
  source,
  onClick,
}: Props) {
  const hasCoordinates =
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    typeof tz === "string" &&
    tz.length > 0;
  const summaryQ = useMoonCard(
    hasCoordinates ? latitude : 0,
    hasCoordinates ? longitude : 0,
    hasCoordinates ? tz : "UTC",
    { label },
  );
  const updatedLabel =
    summaryQ.dataUpdatedAt > 0
      ? formatLocalTime(new Date(summaryQ.dataUpdatedAt).toISOString(), hasCoordinates ? tz : "UTC")
      : "—";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex max-w-full min-w-0 items-start gap-2 rounded-[1.15rem] border border-white/10 bg-slate-900/70 px-3 py-2 text-left text-xs text-white/90 backdrop-blur transition hover:border-white/20 hover:bg-slate-900/90"
    >
      <span
        aria-hidden="true"
        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-300/80 shadow-[0_0_10px_rgba(125,211,252,0.55)]"
      />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 truncate font-medium">{label}</span>
          <span className="hidden text-slate-300/70 lg:inline">
            {typeof latitude === "number" ? latitude.toFixed(3) : "—"},{" "}
            {typeof longitude === "number" ? longitude.toFixed(3) : "—"}
          </span>
          <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-300/72">
            {sourceLabel(source)}
          </span>
        </span>
        <span className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[11px] text-slate-300/72">{tz ?? "Timezone unavailable"}</span>
          <span className="text-[13px] font-semibold text-slate-50">
            Updated {updatedLabel}
          </span>
        </span>
      </span>
    </button>
  );
}
