"use client";

type MoonPhaseCircleProps = {
  illuminationPct: number | undefined; // illumination in percent, 0-100
};

export function MoonPhaseCircle({ illuminationPct }: MoonPhaseCircleProps) {
  if (illuminationPct == null || Number.isNaN(illuminationPct)) {
    return (
      <div
        className="h-10 w-10 rounded-full border border-zinc-500/60"
        aria-hidden="true"
      />
    );
  }

  // Clamp to [0, 100] just in case
  const pct = Math.max(0, Math.min(illuminationPct, 100));
  const rightInset = 100 - pct; // 75% illum => clip 25% from the right

  return (
    <div
      className="relative h-10 w-10 rounded-full bg-black"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 rounded-full bg-white"
        style={{
          // clip-path: inset(top right bottom left);
          // We show a white disk, cropped from the right so that
          // 'pct' % of the circle remains visible.
          clipPath: `inset(0 ${rightInset}% 0 0)`,
        }}
      />
    </div>
  );
}
