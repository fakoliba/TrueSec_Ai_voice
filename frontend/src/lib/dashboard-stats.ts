const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Last N months of counts from ISO date strings. */
export function countsByRecentMonths(
  dates: string[],
  months = 6,
): { labels: string[]; values: number[] } {
  const now = new Date();
  const buckets: { key: string; label: string; count: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    buckets.push({ key, label: MONTH_LABELS[d.getMonth()], count: 0 });
  }

  for (const iso of dates) {
    try {
      const d = new Date(iso);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const bucket = buckets.find((b) => b.key === key);
      if (bucket) bucket.count += 1;
    } catch {
      /* skip */
    }
  }

  return {
    labels: buckets.map((b) => b.label),
    values: buckets.map((b) => b.count),
  };
}

export function areaSeriesFromCounts(values: number[]): number[] {
  return values;
}

/** Average call duration in seconds (only calls with duration > 0). */
export function averageCallDurationSeconds(
  calls: { duration_seconds: number }[],
): number | null {
  const durations = calls.map((c) => c.duration_seconds).filter((d) => d > 0);
  if (durations.length === 0) return null;
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

/** Share of calls with AI summary or linked conversation (0–100). */
export function aiHandledPercent(
  calls: { ai_summary?: string | null; conversation_id?: number | null }[],
): number {
  if (calls.length === 0) return 0;
  const handled = calls.filter((c) => c.ai_summary || c.conversation_id).length;
  return Math.round((handled / calls.length) * 100);
}
