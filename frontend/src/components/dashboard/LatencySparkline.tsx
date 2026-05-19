"use client";

import type { LatencyMetrics } from "@/lib/api";

type LatencySparklineProps = {
  samples: LatencyMetrics["samples"];
  className?: string;
  heightClass?: string;
};

/** Compact latency trend for overview / activity cards. */
export function LatencySparkline({
  samples,
  className,
  heightClass = "h-20",
}: LatencySparklineProps) {
  const w = 280;
  const h = 80;
  const pad = 8;

  if (samples.length === 0) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        No samples yet. API traffic will appear here.
      </p>
    );
  }

  const vals = samples.map((s) => s.duration_ms);
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals, min + 1e-6);
  const range = max - min;
  const points = vals
    .map((v, i) => {
      const x = pad + (i / Math.max(vals.length - 1, 1)) * (w - 2 * pad);
      const y = pad + (1 - (v - min) / range) * (h - 2 * pad);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`mx-auto w-full max-w-[280px] text-chart-1 ${heightClass} ${className ?? ""}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1={pad}
          x2={w - pad}
          y1={h - pad - (h - 2 * pad) * t}
          y2={h - pad - (h - 2 * pad) * t}
          stroke="#e2e8f0"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      ))}
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
