"use client";

import type { ReactNode } from "react";
import {
  DASHBOARD_METRIC_LABEL_CLASS,
  DASHBOARD_MUTED_TEXT_CLASS,
  DASHBOARD_PANEL_CLASS,
  DASHBOARD_PANEL_TITLE_CLASS,
  DASHBOARD_SURFACE_CLASS,
} from "./moonDashboardShared";

type StatusTone = "neutral" | "warning" | "danger";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral:
    "border-white/9 bg-white/[0.03] text-slate-300/80",
  warning:
    "border-amber-300/18 bg-amber-300/10 text-amber-100/88",
  danger:
    "border-red-300/18 bg-red-300/10 text-red-100/90",
};

export function DashboardSkeletonBlock({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-[1rem] bg-white/[0.08] ${className}`.trim()}
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
      className={`rounded-[1rem] border px-3 py-2 text-[10.5px] leading-snug shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] ${TONE_CLASSES[tone]} ${className}`.trim()}
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
      className={`${DASHBOARD_PANEL_CLASS} items-center ${minHeightClass}`.trim()}
    >
      <div
        className={`${DASHBOARD_SURFACE_CLASS} w-full max-w-sm space-y-1.5 border ${TONE_CLASSES[tone]}`.trim()}
      >
        <div className={DASHBOARD_METRIC_LABEL_CLASS}>
          Dashboard
        </div>
        <h2 className={`${DASHBOARD_PANEL_TITLE_CLASS} mt-0`}>
          {title}
        </h2>
        <p className={`text-sm leading-relaxed ${DASHBOARD_MUTED_TEXT_CLASS}`}>{body}</p>
        {children ? <div className="pt-1">{children}</div> : null}
      </div>
    </div>
  );
}
