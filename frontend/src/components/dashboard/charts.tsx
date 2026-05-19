"use client";

type BarChartProps = {
  labels: string[];
  values: number[];
  className?: string;
};

export function MiniBarChart({ labels, values, className }: BarChartProps) {
  const max = Math.max(...values, 1);
  const w = 280;
  const h = 120;
  const barW = Math.min(32, (w - 24) / values.length - 6);
  const gap = (w - 24 - barW * values.length) / Math.max(values.length - 1, 1);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      role="img"
      aria-label="Bar chart"
      preserveAspectRatio="xMidYMid meet"
    >
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1={12}
          x2={w - 8}
          y1={h - 24 - (h - 40) * t}
          y2={h - 24 - (h - 40) * t}
          stroke="#e2e8f0"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      ))}
      {values.map((v, i) => {
        const barH = ((h - 40) * v) / max;
        const x = 12 + i * (barW + gap);
        const y = h - 24 - barH;
        return (
          <rect
            key={labels[i]}
            x={x}
            y={y}
            width={barW}
            height={barH}
            rx={6}
            fill="var(--app-chart-1)"
          />
        );
      })}
      {labels.map((label, i) => (
        <text
          key={`lbl-${label}`}
          x={12 + i * (barW + gap) + barW / 2}
          y={h - 6}
          textAnchor="middle"
          className="fill-[#94a3b8] text-[10px] font-medium"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

type AreaChartProps = {
  values: number[];
  className?: string;
};

export function MiniAreaChart({ values, className }: AreaChartProps) {
  const w = 280;
  const h = 120;
  const max = Math.max(...values, 1);
  const step = (w - 24) / Math.max(values.length - 1, 1);

  const points = values.map((v, i) => {
    const x = 12 + i * step;
    const y = h - 24 - ((h - 40) * v) / max;
    return `${x},${y}`;
  });
  const areaPath = `M12,${h - 24} L${points.join(" L")} L${12 + (values.length - 1) * step},${h - 24} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      role="img"
      aria-label="Area chart"
      preserveAspectRatio="xMidYMid meet"
    >
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1={12}
          x2={w - 8}
          y1={h - 24 - (h - 40) * t}
          y2={h - 24 - (h - 40) * t}
          stroke="#e2e8f0"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      ))}
      <path d={areaPath} fill="var(--app-chart-1-soft)" />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="var(--app-chart-1)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
