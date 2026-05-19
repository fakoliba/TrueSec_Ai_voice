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
import { BusinessPageShell } from "@/components/dashboard/BusinessPageShell";
import { LatencySparkline } from "@/components/dashboard/LatencySparkline";
import { PhiReveal } from "@/components/security/PhiReveal";
import { truncatePhiText } from "@/lib/phi-display";
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
  if (s.includes("progress") || s.includes("ring") || s === "in-progress") {
    return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200";
  }
  if (s.includes("complete") || s.includes("end") || s === "completed") {
    return "bg-primary/15 text-primary ring-1 ring-primary/25";
  }
  if (s.includes("fail") || s.includes("busy")) {
    return "bg-red-50 text-red-700 ring-1 ring-red-200";
  }
  return "bg-muted/40 text-muted-foreground ring-1 ring-border";
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="flex min-h-[120px] flex-col items-center justify-center px-4 py-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
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
    Promise.all([
      listBusinessCallLogs(Number(id), { limit: 50 }),
      listBusinessConversations(Number(id), { limit: 50 }),
    ])
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
    <BusinessPageShell
      section="Call activity"
      title="Call activity & conversations"
      description="Voice calls and AI conversations for this workspace. Select a call to view insights."
    >
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading activity…</p>
        </div>
      ) : (
        <div className="activity-dashboard space-y-6">
          {/* Analytics row */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="flex flex-col p-5 sm:p-6">
              <h2 className="text-sm font-semibold text-foreground">Agent performance</h2>
              <p className="mt-1 text-center text-xs text-muted-foreground sm:text-left">
                Calls by status (recent)
              </p>
              <div className="mt-5 flex flex-1 flex-col justify-center space-y-3">
                {statusCounts.length === 0 ? (
                  <EmptyBlock message="No call data yet." />
                ) : (
                  statusCounts.slice(0, 6).map(([label, count]) => (
                    <div key={label} className="w-full max-w-md mx-auto sm:mx-0">
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span className="truncate capitalize">{label}</span>
                        <span className="font-medium text-foreground">{count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#f1f5f9]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-chart-3 to-chart-1"
                          style={{ width: `${Math.min(100, (count / maxStatus) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="flex flex-col p-5 sm:p-6">
              <h2 className="text-sm font-semibold text-foreground">System latency</h2>
              <p className="mt-1 text-center text-xs text-muted-foreground sm:text-left">
                Recent API request times (server middleware, in-memory).
              </p>
              {latencyError ? (
                <p className="mt-4 text-center text-xs text-red-600">{latencyError}</p>
              ) : latencyMetrics ? (
                <div className="mt-4 flex flex-1 flex-col items-center justify-center">
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      avg{" "}
                      <strong className="text-foreground">
                        {latencyMetrics.avg_ms != null ? `${latencyMetrics.avg_ms} ms` : "—"}
                      </strong>
                    </span>
                    <span>
                      p50{" "}
                      <strong className="text-foreground">
                        {latencyMetrics.p50_ms != null ? `${latencyMetrics.p50_ms} ms` : "—"}
                      </strong>
                    </span>
                    <span>
                      p95{" "}
                      <strong className="text-foreground">
                        {latencyMetrics.p95_ms != null ? `${latencyMetrics.p95_ms} ms` : "—"}
                      </strong>
                    </span>
                    <span>
                      n=<strong className="text-foreground">{latencyMetrics.count}</strong>
                    </span>
                  </div>
                  <div className="mt-4 flex w-full justify-center rounded-xl border border-border bg-[#f8fafc] p-4">
                    <LatencySparkline samples={latencyMetrics.samples} />
                  </div>
                </div>
              ) : (
                <EmptyBlock message="Loading metrics…" />
              )}
            </Card>
          </div>

          {/* Calls + insights */}
          <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
            <div className="space-y-6 lg:col-span-7">
              <Card className="p-5 sm:p-6">
                <div className="border-b border-border pb-4 text-center sm:text-left">
                  <h2 className="text-base font-semibold text-foreground">Appointment & voice calls</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {callLogs.length} call{callLogs.length === 1 ? "" : "s"} recorded
                  </p>
                </div>

                {callLogs.length === 0 ? (
                  <EmptyBlock message="No call logs yet. Calls will appear here when customers reach your voice line." />
                ) : (
                  <ul className="mt-4 space-y-3">
                    {callLogs.map((log) => (
                      <li key={log.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(log.id)}
                          className={cn(
                            "w-full rounded-xl border p-4 text-left transition-all duration-200",
                            selectedId === log.id
                              ? "border-primary/40 bg-primary/5 shadow-sm ring-2 ring-primary/20"
                              : "border-border bg-white hover:border-primary/25 hover:shadow-sm",
                          )}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 text-center sm:text-left">
                              <p className="text-sm font-semibold text-foreground">
                                <PhiReveal value={log.phone_number} kind="phone" />
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {new Date(log.created_at).toLocaleString()} · {log.direction} ·{" "}
                                {log.duration_seconds > 0 ? `${log.duration_seconds}s` : "—"}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize",
                                statusBadgeClass(log.status),
                              )}
                            >
                              {log.status}
                            </span>
                          </div>
                          {log.intent && (
                            <span className="mt-2 inline-block rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              {log.intent}
                            </span>
                          )}
                          {log.ai_summary && (
                            <p className="mt-2 line-clamp-2 text-center text-xs text-muted-foreground sm:text-left">
                              {log.ai_summary}
                            </p>
                          )}
                          <div
                            className="mt-3 flex justify-center border-t border-border/60 pt-3 sm:justify-start"
                            onClick={(e) => e.stopPropagation()}
                            role="presentation"
                          >
                            {log.conversation_id ? (
                              <Link
                                href={`/dashboard/${id}/conversations/${log.conversation_id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs font-medium text-primary hover:underline"
                              >
                                View AI conversation →
                              </Link>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">
                                No linked conversation
                              </span>
                            )}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="p-5 sm:p-6">
                <h2 className="text-center text-base font-semibold text-foreground sm:text-left">
                  Conversations
                </h2>
                {conversations.length === 0 ? (
                  <EmptyBlock message="No conversations yet." />
                ) : (
                  <ul className="mt-4 space-y-2">
                    {conversations.slice(0, 8).map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-col items-center justify-between gap-2 rounded-xl border border-border bg-[#f8fafc] px-4 py-3 text-sm sm:flex-row"
                      >
                        <span className="text-center font-medium text-foreground sm:text-left">
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

            <div className="lg:col-span-5">
              <Card className="p-5 sm:sticky sm:top-24 sm:p-6">
                <h2 className="text-center text-base font-semibold text-foreground sm:text-left">
                  AI insights & actions
                </h2>
                {!selectedLog ? (
                  <EmptyBlock message="Select a call from the list to view insights." />
                ) : (
                  <div className="mt-4 space-y-5">
                    <div className="rounded-xl border border-border bg-[#f8fafc] p-4 text-center sm:text-left">
                      {selectedLog.conversation_id ? (
                        <Link
                          href={`/dashboard/${id}/conversations/${selectedLog.conversation_id}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          View full AI conversation transcript →
                        </Link>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No linked AI conversation for this call.
                        </p>
                      )}
                    </div>

                    <div className="text-center">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Sentiment
                      </p>
                      <div className="mt-3 flex justify-center">
                        <div
                          className="relative h-16 w-32 rounded-t-full border border-primary/30 bg-gradient-to-t from-[#dcfce7] to-[#f0fdf4]"
                          aria-hidden
                        >
                          <div className="absolute bottom-1 left-1/2 h-8 w-1 -translate-x-1/2 rounded-full bg-primary" />
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">Estimated (demo)</p>
                    </div>

                    {selectedLog.ai_summary && (
                      <div className="rounded-xl border border-border bg-white p-4 text-center sm:text-left">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Summary
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-foreground">
                          {selectedLog.ai_summary}
                        </p>
                      </div>
                    )}

                    {transcriptPreview(selectedLog.transcript) && (
                      <details className="rounded-xl border border-border bg-white p-4">
                        <summary className="cursor-pointer text-center text-xs font-medium text-primary hover:underline sm:text-left">
                          Transcript preview
                        </summary>
                        <p className="mt-3 max-h-32 overflow-y-auto rounded-lg border border-border bg-[#f8fafc] p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                          {transcriptPreview(selectedLog.transcript)}
                        </p>
                      </details>
                    )}

                    <p className="text-center text-[11px] text-muted-foreground sm:text-left">
                      Team help chat is paused until in-app help (RAG) is enabled.
                    </p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </BusinessPageShell>
  );
}
