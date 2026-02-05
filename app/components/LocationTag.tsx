"use client";

type Props = {
  label: string;
  latitude: number;
  longitude: number;
  source: "geolocation" | "fallback" | "cache";
};

export default function LocationTag({
  label,
  latitude,
  longitude,
  source,
}: Props) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-xs text-white/90 backdrop-blur">
      <span aria-hidden="true">📍</span>
      <span className="font-medium">{label}</span>
      <span className="opacity-70">
        {latitude.toFixed(3)}, {longitude.toFixed(3)}
      </span>
      <span className="opacity-60">({source})</span>
    </div>
  );
}
