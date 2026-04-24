"use client";

import { useId } from "react";

type MoonPhaseCircleProps = {
  illuminationPct?: number; // 0-100
  illuminationFrac?: number; // 0-1
  waxing?: boolean;
  phaseAngleDeg?: number; // 0=new, 180=full
  tiltDeg?: number;
  brightLimbAngleDeg?: number;
  mode?: "svg" | "g";
  renderMode?: "svg" | "g";
  size?: number;
  cx?: number;
  cy?: number;
  r?: number;
  className?: string;
  variant?: "flat" | "photo";
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const MOON_TEXTURE_URL =
  "https://commons.wikimedia.org/wiki/Special:Redirect/file/FullMoon2010.jpg";

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function formatPathNumber(value: number, decimals = 4): string {
  const rounded = Number(value.toFixed(decimals));
  return Number.isFinite(rounded) ? rounded.toString() : "0";
}

function buildLitPath(
  cx: number,
  cy: number,
  r: number,
  litFrac: number,
  waxing: boolean,
): string {
  const f = clamp01(litFrac);
  if (f <= 1e-4 || r <= 0) return "";

  const topY = cy - r;
  const bottomY = cy + r;

  if (f >= 1 - 1e-4) {
    return [
      `M ${formatPathNumber(cx)},${formatPathNumber(topY)}`,
      `A ${formatPathNumber(r)},${formatPathNumber(r)} 0 1 1 ${formatPathNumber(cx)},${formatPathNumber(bottomY)}`,
      `A ${formatPathNumber(r)},${formatPathNumber(r)} 0 1 1 ${formatPathNumber(cx)},${formatPathNumber(topY)}`,
      "Z",
    ].join(" ");
  }

  // Signed terminator position model:
  // x_t(y) = coeff * sqrt(r^2 - (y-cy)^2), where coeff in [-1, 1].
  // coeff = (1 - 2f) for waxing, mirrored for waning.
  const coeff = (waxing ? 1 : -1) * (1 - 2 * f);
  const terminatorRx = Math.max(r * 1e-4, Math.abs(coeff) * r);
  const litSideSweepDown = waxing ? 1 : 0; // top->bottom along lit limb
  const terminatorSweepUp = coeff >= 0 ? 0 : 1; // bottom->top along terminator side

  return [
    `M ${formatPathNumber(cx)},${formatPathNumber(topY)}`,
    `A ${formatPathNumber(r)},${formatPathNumber(r)} 0 0 ${litSideSweepDown} ${formatPathNumber(cx)},${formatPathNumber(bottomY)}`,
    `A ${formatPathNumber(terminatorRx)},${formatPathNumber(r)} 0 0 ${terminatorSweepUp} ${formatPathNumber(cx)},${formatPathNumber(topY)}`,
    "Z",
  ].join(" ");
}

export function MoonPhaseCircle({
  illuminationPct,
  illuminationFrac,
  waxing = true,
  phaseAngleDeg,
  tiltDeg,
  brightLimbAngleDeg,
  mode,
  renderMode = "svg",
  size = 40,
  cx = 50,
  cy = 50,
  r,
  className,
  variant = "flat",
}: MoonPhaseCircleProps) {
  const resolvedMode = mode ?? renderMode;
  const idPrefix = useId().replace(/:/g, "-");
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
  const strokeWidth = Math.max(0.35, resolvedR * 0.08);

  const safeTilt = Number.isFinite(resolvedTiltDeg) ? resolvedTiltDeg : 0;
  const hasIllum = resolvedPct != null && !Number.isNaN(resolvedPct);
  const hasAngle = phaseAngleDeg != null && Number.isFinite(phaseAngleDeg);
  const litFracFromIllum = hasIllum ? clamp01((resolvedPct as number) / 100) : 0;
  const normalizedPhaseDeg = hasAngle ? normalizeDeg(phaseAngleDeg as number) : 0;
  const litFracFromAngle = hasAngle
    ? clamp01((1 - Math.cos((normalizedPhaseDeg * Math.PI) / 180)) / 2)
    : 0;
  const litFrac = hasAngle ? litFracFromAngle : litFracFromIllum;
  const resolvedWaxing = hasAngle ? normalizedPhaseDeg < 180 : waxing;
  const litPath = buildLitPath(cx, cy, resolvedR, litFrac, resolvedWaxing);
  const clipId = `${idPrefix}-moon-clip`;
  const litMaskId = `${idPrefix}-moon-lit-mask`;

  if (!hasIllum && !hasAngle) {
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

  const glyph =
    variant === "photo" ? (
      <g aria-hidden="true">
        <defs>
          <clipPath id={clipId}>
            <circle cx={cx} cy={cy} r={resolvedR} />
          </clipPath>
          <mask id={litMaskId} maskUnits="userSpaceOnUse">
            <rect
              x={cx - resolvedR - 1}
              y={cy - resolvedR - 1}
              width={resolvedR * 2 + 2}
              height={resolvedR * 2 + 2}
              fill="black"
            />
            <g transform={`rotate(${safeTilt} ${cx} ${cy})`}>
              {litPath ? <path d={litPath} fill="white" /> : null}
            </g>
          </mask>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <circle cx={cx} cy={cy} r={resolvedR} fill="#020617" />
          <image
            href={MOON_TEXTURE_URL}
            x={cx - resolvedR}
            y={cy - resolvedR}
            width={resolvedR * 2}
            height={resolvedR * 2}
            preserveAspectRatio="xMidYMid slice"
            opacity="0.2"
          />
          <circle
            cx={cx}
            cy={cy}
            r={resolvedR}
            fill="rgba(2,6,23,0.68)"
          />
          <image
            href={MOON_TEXTURE_URL}
            x={cx - resolvedR}
            y={cy - resolvedR}
            width={resolvedR * 2}
            height={resolvedR * 2}
            preserveAspectRatio="xMidYMid slice"
            mask={`url(#${litMaskId})`}
          />
          <circle
            cx={cx}
            cy={cy}
            r={resolvedR}
            fill="rgba(255,255,255,0.04)"
          />
        </g>
      </g>
    ) : (
      <g aria-hidden="true">
        <circle cx={cx} cy={cy} r={resolvedR} fill="#020617" />
        <g transform={`rotate(${safeTilt} ${cx} ${cy})`}>
          {litPath ? <path d={litPath} fill="#f8fafc" /> : null}
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
