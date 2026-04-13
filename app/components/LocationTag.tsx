"use client";

type Props = {
  label: string;
  latitude?: number;
  longitude?: number;
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
  source,
  onClick,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex max-w-full min-w-0 items-center gap-2 rounded-full border border-white/10 bg-slate-900/70 px-3 py-1.5 text-xs text-white/90 backdrop-blur transition hover:border-white/20 hover:bg-slate-900/90"
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 shrink-0 rounded-full bg-sky-300/80 shadow-[0_0_10px_rgba(125,211,252,0.55)]"
      />
      <span className="min-w-0 truncate font-medium">{label}</span>
      <span className="hidden text-slate-300/70 lg:inline">
        {typeof latitude === "number" ? latitude.toFixed(3) : "—"},{" "}
        {typeof longitude === "number" ? longitude.toFixed(3) : "—"}
      </span>
      <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-300/72">
        {sourceLabel(source)}
      </span>
    </button>
  );
}
