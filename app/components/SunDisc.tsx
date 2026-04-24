"use client";

import { useId } from "react";

type SunDiscProps = {
  mode?: "svg" | "g";
  renderMode?: "svg" | "g";
  size?: number;
  cx?: number;
  cy?: number;
  r?: number;
  className?: string;
};

const SUN_TEXTURE_URL =
  "https://commons.wikimedia.org/wiki/Special:Redirect/file/A%20Smiling%20Sun.jpg";

export function SunDisc({
  mode,
  renderMode = "svg",
  size = 40,
  cx = 50,
  cy = 50,
  r,
  className,
}: SunDiscProps) {
  const resolvedMode = mode ?? renderMode;
  const resolvedR = r ?? 46;
  const strokeWidth = Math.max(0.35, resolvedR * 0.08);
  const idPrefix = useId().replace(/:/g, "-");
  const clipId = `${idPrefix}-sun-clip`;

  const glyph = (
    <g aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={resolvedR} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <circle cx={cx} cy={cy} r={resolvedR} fill="#f59e0b" />
        <image
          href={SUN_TEXTURE_URL}
          x={cx - resolvedR}
          y={cy - resolvedR}
          width={resolvedR * 2}
          height={resolvedR * 2}
          preserveAspectRatio="xMidYMid slice"
        />
        <circle
          cx={cx}
          cy={cy}
          r={resolvedR}
          fill="rgba(255,224,120,0.08)"
        />
      </g>
      <circle
        cx={cx}
        cy={cy}
        r={resolvedR}
        fill="none"
        stroke="rgba(254,249,195,0.52)"
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
