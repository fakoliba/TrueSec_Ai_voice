"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  getBusinessLatencyMetrics,
  listBusinessCallLogs,
  listBusinessConversations,
} from "@/lib/api";
import type { CallLog, Conversation, LatencyMetrics } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

function transcriptPreview(transcript: unknown): string {
  if (transcript == null || transcript === "") return "";
  if (typeof transcript === "string") return transcript.length > 220 ? `${transcript.slice(0, 220)}…` : transcript;
  try {
    const s = JSON.stringify(transcript);
    return s.length > 220 ? `${s.slice(0, 220)}…` : s;
  } catch {
    return "";
  }
}

function statusBadgeClass(status: string) {
  const s = status.toLowerCase();
  if (s.includes("progress") || s.includes("ring") || s === "in-progress")
    return "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40";
  if (s.includes("complete") || s.includes("end") || s === "completed")
    return "bg-primary/20 text-primary ring-1 ring-primary/30";
  if (s.includes("fail") || s.includes("busy")) return "bg-red-500/20 text-red-300 ring-1 ring-red-500/30";
  return "bg-muted/30 text-muted-foreground ring-1 ring-border";
}

function LatencySparkline({ samples }: { samples: LatencyMetrics["samples"] }) {
  const w = 120;
  const h = 44;
  const pad = 4;
  if (samples.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">No samples yet. Use the dashboard to generate API traffic.</p>
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
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full text-primary/85" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={points} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function BusinessActivityPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [latencyMetrics, setLatencyMetrics] = useState<LatencyMetrics | null>(null);
  const [latencyError, setLatencyError] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    setLoading(true);
    setLatencyError(null);
    getBusinessLatencyMetrics(Number(id), { limit: 80 })
      .then((m) => {
        setLatencyMetrics(m);
        setLatencyError(null);
      })
      .catch((e: unknown) =>
        setLatencyError(e instanceof Error ? e.message : "Could not load latency metrics"),
      );
    Promise.all([listBusinessCallLogs(Number(id), { limit: 50 }), listBusinessConversations(Number(id), { limit: 50 })])
      .then(([logs, convs]) => {
        setCallLogs(logs);
        setConversations(convs);
        if (logs.length > 0) setSelectedId(logs[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, router]);

  const statusCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const log of callLogs) {
      const k = log.status || "unknown";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [callLogs]);

  const maxStatus = Math.max(1, ...statusCounts.map(([, n]) => n));

  const selectedLog = callLogs.find((l) => l.id === selectedId) ?? null;

  return (
    <div>
      <Link
        href={`/dashboard/${id}`}
        className="mb-4 inline-block text-sm font-medium text-primary hover:underline"
      >
        ← Back to overview
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Call activity &amp; conversations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Voice calls and AI conversations for this workspace. Select a call to view insights.
        </p>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-12">
          {/* Left: analytics */}
          <div className="space-y-4 xl:col-span-3">
            <Card className="p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Agent performance
              </h2>
              <p className="mt-1 text-[11px] text-muted-foreground">Calls by status (recent)</p>
              <div className="mt-4 space-y-2">
                {statusCounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No call data yet.</p>
                ) : (
                  statusCounts.slice(0, 6).map(([label, count]) => (
                    <div key={label}>
                      <div className="mb-0.5 flex justify-between text-xs text-muted-foreground">
                        <span className="truncate capitalize">{label}</span>
                        <span>{count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-background ring-1 ring-border">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-secondary to-primary"
                          style={{ width: `${Math.min(100, (count / maxStatus) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                System latency
              </h2>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Recent API request times for this workspace (server middleware, in-memory).
              </p>
              {latencyError ? (
                <p className="mt-3 text-[11px] text-amber-400/90">{latencyError}</p>
              ) : latencyMetrics ? (
                <>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                    <span>avg {latencyMetrics.avg_ms != null ? `${latencyMetrics.avg_ms} ms` : "—"}</span>
                    <span>p50 {latencyMetrics.p50_ms != null ? `${latencyMetrics.p50_ms} ms` : "—"}</span>
                    <span>p95 {latencyMetrics.p95_ms != null ? `${latencyMetrics.p95_ms} ms` : "—"}</span>
                    <span>n={latencyMetrics.count}</span>
                  </div>
                  <div className="mt-3 h-24 rounded-lg border border-border bg-background/80 p-2">
                    <LatencySparkline samples={latencyMetrics.samples} />
                  </div>
                </>
              ) : (
                <p className="mt-3 text-[11px] text-muted-foreground">Loading metrics…</p>
              )}
            </Card>
          </div>

          {/* Center: call list */}
          <div className="min-w-0 space-y-3 xl:col-span-6">
            <h2 className="text-sm font-semibold text-foreground">Appointment &amp; voice calls</h2>
            {callLogs.length === 0 ? (
              <Card className="p-6 text-sm text-muted-foreground">No call logs yet.</Card>
            ) : (
              callLogs.map((log) => (
                <button
                  key={log.id}
                  type="button"
                  onClick={() => setSelectedId(log.id)}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left transition hover:border-primary/40",
                    selectedId === log.id
                      ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border bg-card ring-1 ring-border/20",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-sm font-semibold text-foreground">{log.phone_number}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()} · {log.direction} ·{" "}
                        {log.duration_seconds > 0 ? `${log.duration_seconds}s` : "—"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize",
                        statusBadgeClass(log.status),
                      )}
                    >
                      {log.status}
                    </span>
                  </div>
                  {log.intent && (
                    <span className="mt-2 inline-block rounded-md bg-secondary/25 px-2 py-0.5 text-xs font-medium text-primary">
                      {log.intent}
                    </span>
                  )}
                  {log.ai_summary && (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{log.ai_summary}</p>
                  )}
                  <div
                    className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3"
                    onClick={(e) => e.stopPropagation()}
                    role="presentation"
                  >
                    {log.conversation_id ? (
                      <Link
                        href={`/dashboard/${id}/conversations/${log.conversation_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        View AI conversation
                      </Link>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">No linked conversation</span>
                    )}
                  </div>
                </button>
              ))
            )}

            <Card className="p-4">
              <h3 className="text-sm font-semibold text-foreground">Conversations</h3>
              {conversations.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No conversations yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {conversations.slice(0, 8).map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border py-2 px-3 text-sm"
                    >
                      <span className="text-foreground">
                        {c.channel} · {new Date(c.updated_at).toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {Array.isArray(c.messages) ? c.messages.length : 0} messages
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Right: insights */}
          <div className="xl:col-span-3">
            <Card className="sticky top-20 p-4">
              <h2 className="text-sm font-semibold text-foreground">AI insights &amp; actions</h2>
              {!selectedLog ? (
                <p className="mt-3 text-sm text-muted-foreground">Select a call from the list.</p>
              ) : (
                <>
                  <div className="mt-3 border-b border-border pb-3">
                    {selectedLog.conversation_id ? (
                      <Link
                        href={`/dashboard/${id}/conversations/${selectedLog.conversation_id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        View full AI conversation transcript
                      </Link>
                    ) : (
                      <p className="text-xs text-muted-foreground">No linked AI conversation for this call.</p>
                    )}
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sentiment</p>
                    <div className="mt-2 flex items-center justify-center">
                      <div
                        className="relative h-16 w-32 rounded-t-full border border-primary/40 bg-gradient-to-t from-secondary/40 to-primary/20"
                        aria-hidden
                      >
                        <div className="absolute bottom-1 left-1/2 h-8 w-1 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_14px_rgba(212,175,55,0.55)]" />
                      </div>
                    </div>
                    <p className="mt-1 text-center text-[11px] text-muted-foreground">Estimated (demo)</p>
                  </div>

                  {selectedLog.ai_summary && (
                    <div className="mt-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Summary</p>
                      <p className="mt-1 text-sm text-foreground">{selectedLog.ai_summary}</p>
                    </div>
                  )}

                  {transcriptPreview(selectedLog.transcript) && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-xs font-medium text-primary hover:underline">
                        Transcript preview
                      </summary>
                      <p className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-border bg-background p-2 font-mono text-[11px] text-muted-foreground">
                        {transcriptPreview(selectedLog.transcript)}
                      </p>
                    </details>
                  )}

                  <p className="mt-6 text-[11px] text-muted-foreground">
                    Team help chat is paused until in-app help (RAG) is enabled.
                  </p>
                </>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
