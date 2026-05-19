import { Card } from "@/components/ui/Card";
import type { ReactNode } from "react";

type MetricCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  chart: ReactNode;
  footer?: ReactNode;
};

export function MetricCard({ title, value, subtitle, chart, footer }: MetricCardProps) {
  return (
    <Card className="flex min-h-[220px] flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <select
          className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition hover:border-primary/20 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
          defaultValue="all"
          aria-label={`${title} period`}
        >
          <option value="all">All Months</option>
        </select>
      </div>
      <div className="mt-4 flex flex-1 items-end justify-center">{chart}</div>
      {footer && <div className="mt-3 border-t border-border/80 pt-3">{footer}</div>}
    </Card>
  );
}
