"use client";

import type { ReactNode } from "react";

type StatusTone = "neutral" | "warning" | "danger";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral:
    "border-white/10 bg-white/[0.03] text-slate-300/80",
  warning:
    "border-amber-300/18 bg-amber-300/8 text-amber-100/88",
  danger:
    "border-red-300/18 bg-red-300/8 text-red-100/90",
};

export function DashboardSkeletonBlock({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-white/[0.08] ${className}`.trim()}
    />
  );
}

export function DashboardStatusBanner({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`rounded-xl border px-2.5 py-2 text-[11px] leading-snug ${TONE_CLASSES[tone]} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export function DashboardPanelState({
  title,
  body,
  tone = "neutral",
  minHeightClass = "min-h-[21rem]",
  children,
}: {
  title: string;
  body: string;
  tone?: StatusTone;
  minHeightClass?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`flex h-full w-full items-center rounded-[1.5rem] border p-4 shadow-lg shadow-black/25 ring-1 ring-white/8 backdrop-blur ${TONE_CLASSES[tone]} ${minHeightClass}`.trim()}
    >
      <div className="max-w-sm space-y-1.5">
        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-300/55">
          Dashboard
        </div>
        <h2 className="text-sm font-semibold tracking-tight text-slate-50">
          {title}
        </h2>
        <p className="text-sm text-slate-300/78">{body}</p>
        {children ? <div className="pt-1">{children}</div> : null}
      </div>
    </div>
  );
}
