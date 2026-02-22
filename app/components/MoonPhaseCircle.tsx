"use client";

import { useId } from "react";

type MoonPhaseCircleProps = {
  illuminationPct?: number; // 0-100
  illuminationFrac?: number; // 0-1
  waxing?: boolean;
  tiltDeg?: number;
  brightLimbAngleDeg?: number;
  mode?: "svg" | "g";
  renderMode?: "svg" | "g";
  size?: number;
  cx?: number;
  cy?: number;
  r?: number;
  className?: string;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function litFractionForUnitOffset(unitOffset: number): number {
  const x = clamp01(unitOffset);
  const overlapFrac =
    (2 * Math.acos(x) - 2 * x * Math.sqrt(Math.max(0, 1 - x * x))) / Math.PI;
  return 1 - overlapFrac;
}

function unitOffsetForLitFraction(litFrac: number): number {
  const target = clamp01(litFrac);
  if (target <= 0) return 0;
  if (target >= 1) return 1;

  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 28; i += 1) {
    const mid = (lo + hi) / 2;
    const lit = litFractionForUnitOffset(mid);
    if (lit < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function MoonPhaseCircle({
  illuminationPct,
  illuminationFrac,
  waxing = true,
  tiltDeg,
  brightLimbAngleDeg,
  mode,
  renderMode = "svg",
  size = 40,
  cx = 50,
  cy = 50,
  r,
  className,
}: MoonPhaseCircleProps) {
  const id = useId().replace(/:/g, "-");
  const resolvedMode = mode ?? renderMode;
  const resolvedPct =
    illuminationPct ??
    (illuminationFrac != null && !Number.isNaN(illuminationFrac)
      ? illuminationFrac * 100
      : undefined);
  const resolvedTiltDeg =
    tiltDeg ??
    (brightLimbAngleDeg != null && !Number.isNaN(brightLimbAngleDeg)
      ? brightLimbAngleDeg - 270
      : 0);
  const resolvedR = r ?? 46;
  const strokeWidth = Math.max(0.75, resolvedR * 0.08);

  const safeTilt = Number.isFinite(resolvedTiltDeg) ? resolvedTiltDeg : 0;
  const hasValue = resolvedPct != null && !Number.isNaN(resolvedPct);
  const pct = hasValue ? Math.max(0, Math.min(resolvedPct, 100)) : 0;
  const litFrac = pct / 100;
  const phaseOffset = 2 * resolvedR * unitOffsetForLitFraction(litFrac);
  const shadowCx = waxing ? cx - phaseOffset : cx + phaseOffset;

  if (resolvedPct == null || Number.isNaN(resolvedPct)) {
    if (resolvedMode === "g") {
      return (
        <g aria-hidden="true">
          <circle
            cx={cx}
            cy={cy}
            r={resolvedR}
            fill="transparent"
            stroke="rgba(161,161,170,0.6)"
            strokeWidth={Math.max(0.75, resolvedR * 0.12)}
          />
        </g>
      );
    }

    return (
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className={className}
        aria-hidden="true"
      >
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="transparent"
          stroke="rgba(161,161,170,0.6)"
          strokeWidth="3"
        />
      </svg>
    );
  }

  const maskId = `${id}-moon-lit-mask`;
  const maskPad = resolvedR * 3;
  const glyph = (
    <g aria-hidden="true">
      <defs>
        <mask
          id={maskId}
          x={cx - maskPad}
          y={cy - maskPad}
          width={maskPad * 2}
          height={maskPad * 2}
          maskUnits="userSpaceOnUse"
        >
          <rect
            x={cx - maskPad}
            y={cy - maskPad}
            width={maskPad * 2}
            height={maskPad * 2}
            fill="black"
          />
          <circle cx={cx} cy={cy} r={resolvedR} fill="white" />
          <circle cx={shadowCx} cy={cy} r={resolvedR} fill="black" />
        </mask>
      </defs>

      <circle cx={cx} cy={cy} r={resolvedR} fill="#000" />
      <g transform={`rotate(${safeTilt} ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={resolvedR} fill="#fff" mask={`url(#${maskId})`} />
      </g>
      <circle
        cx={cx}
        cy={cy}
        r={resolvedR}
        fill="none"
        stroke="rgba(226,232,240,0.45)"
        strokeWidth={strokeWidth}
      />
    </g>
  );

  if (resolvedMode === "g") {
    return glyph;
  }

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      {glyph}
    </svg>
  );
}
