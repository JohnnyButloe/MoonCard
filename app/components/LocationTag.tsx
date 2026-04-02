"use client";

type Props = {
  label: string;
  latitude?: number;
  longitude?: number;
  source: "current" | "home" | "saved" | "fallback";
  onClick?: () => void;
};

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
      className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-xs text-white/90 backdrop-blur transition hover:border-white/20 hover:bg-slate-900/90"
    >
      <span aria-hidden="true">📍</span>
      <span className="font-medium">{label}</span>
      <span className="opacity-70">
        {typeof latitude === "number" ? latitude.toFixed(3) : "—"},{" "}
        {typeof longitude === "number" ? longitude.toFixed(3) : "—"}
      </span>
      <span className="opacity-60">({source})</span>
    </button>
  );
}
