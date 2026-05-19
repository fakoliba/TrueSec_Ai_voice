"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  apiFetch,
  getBusinessLatencyMetrics,
  listBusinessCallLogs,
  listBusinessConversations,
  listBusinessUsers,
} from "@/lib/api";
import type { Business, BusinessMember, CallLog, Conversation, LatencyMetrics } from "@/lib/api";
import {
  aiHandledPercent,
  areaSeriesFromCounts,
  averageCallDurationSeconds,
  countsByRecentMonths,
} from "@/lib/dashboard-stats";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { LatencySparkline } from "@/components/dashboard/LatencySparkline";
import { MiniAreaChart, MiniBarChart } from "@/components/dashboard/charts";
import { OverviewBusinessCard } from "@/components/dashboard/OverviewBusinessCard";
import { StaffSchedulesCard } from "@/components/dashboard/StaffSchedulesCard";

type Appointment = { id: number; start_time: string };

function formatDate(iso?: string) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export default function BusinessDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const businessId = Number(id);

  const [business, setBusiness] = useState<Business | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [latencyMetrics, setLatencyMetrics] = useState<LatencyMetrics | null>(null);
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }

    const headers = { token };
    Promise.all([
      apiFetch(`/api/businesses/${id}`, headers).then(async (res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        if (!res.ok) throw new Error("Failed to load business");
        return res.json() as Promise<Business>;
      }),
      apiFetch(`/api/businesses/${id}/appointments`, headers)
        .then((res) => (res.ok ? res.json() : []))
        .catch(() => [] as Appointment[]),
      listBusinessCallLogs(businessId, { limit: 200 }).catch(() => [] as CallLog[]),
      listBusinessConversations(businessId, { limit: 100 }).catch(() => [] as Conversation[]),
      getBusinessLatencyMetrics(businessId, { limit: 60 }).catch(() => null),
      listBusinessUsers(businessId).catch(() => [] as BusinessMember[]),
    ])
      .then(([b, appts, logs, convs, latency, team]) => {
        if (b) setBusiness(b);
        setAppointments(Array.isArray(appts) ? appts : []);
        setCallLogs(Array.isArray(logs) ? logs : []);
        setConversations(Array.isArray(convs) ? convs : []);
        setLatencyMetrics(latency);
        setMembers(Array.isArray(team) ? team : []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error"))
      .finally(() => {
        setLoading(false);
        setMembersLoading(false);
      });
  }, [id, router, businessId]);

  const appointmentChart = useMemo(
    () => countsByRecentMonths(appointments.map((a) => a.start_time)),
    [appointments],
  );

  const callChart = useMemo(
    () => countsByRecentMonths(callLogs.map((c) => c.created_at)),
    [callLogs],
  );

  const aiHandledChart = useMemo(
    () =>
      countsByRecentMonths(
        callLogs
          .filter((c) => c.ai_summary || c.conversation_id)
          .map((c) => c.created_at),
      ),
    [callLogs],
  );

  const aiHandledCalls = useMemo(
    () => callLogs.filter((c) => c.ai_summary || c.conversation_id).length,
    [callLogs],
  );

  const aiRate = useMemo(() => aiHandledPercent(callLogs), [callLogs]);
  const avgCallDuration = useMemo(() => averageCallDurationSeconds(callLogs), [callLogs]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading dashboard…</p>
      </div>
    );
  }

  if (error || !business) {
    return (
      <div>
        <p className="text-red-600">{error || "Not found"}</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          ← Back to businesses
        </Link>
      </div>
    );
  }

  const created = formatDate(business.created_at);
  const updated = formatDate(business.updated_at);

  const latencyValue =
    latencyMetrics?.avg_ms != null ? `${latencyMetrics.avg_ms} ms` : "—";
  const latencySubtitle = latencyMetrics
    ? [
        latencyMetrics.p50_ms != null ? `p50 ${latencyMetrics.p50_ms} ms` : null,
        latencyMetrics.p95_ms != null ? `p95 ${latencyMetrics.p95_ms} ms` : null,
        `n=${latencyMetrics.count}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "API response times (in-memory)";

  return (
    <div className="overview-dashboard w-full">
      <nav
        className="dashboard-breadcrumb mb-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-3 text-center text-sm text-muted-foreground sm:justify-start sm:text-left"
        aria-label="Breadcrumb"
      >
        <Link href="/dashboard" className="font-medium hover:text-primary">
          Dashboard
        </Link>
        <span className="text-border">/</span>
        <span className="font-medium text-foreground">{business.name}</span>
        <span className="text-border">/</span>
        <span className="font-semibold text-primary">Overview</span>
      </nav>

      <header className="mb-6 text-center sm:mb-8 sm:text-left">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">AI receptionist overview</h1>
        <p className="dashboard-hint mx-auto mt-2 max-w-2xl text-sm sm:mx-0">
          Voice call volume, AI handling, system latency, and bookings — live from your workspace.
        </p>
      </header>

      <section className="overview-metrics-grid mb-6">
        <MetricCard
          title="Voice calls"
          value={callLogs.length}
          subtitle={`Avg duration ${formatDuration(avgCallDuration)}`}
          chart={
            <MiniBarChart
              labels={callChart.labels}
              values={callChart.values}
              className="h-[120px] w-full"
            />
          }
          footer={
            <Link
              href={`/dashboard/${id}/activity`}
              className="text-xs font-medium text-primary hover:underline"
            >
              View call activity →
            </Link>
          }
        />
        <MetricCard
          title="AI-handled calls"
          value={aiHandledCalls}
          subtitle={`${aiRate}% of ${callLogs.length} calls`}
          chart={
            <MiniAreaChart
              values={areaSeriesFromCounts(aiHandledChart.values)}
              className="h-[120px] w-full"
            />
          }
          footer={
            <p className="dashboard-hint text-xs">
              Calls with AI summary or linked conversation
            </p>
          }
        />
        <MetricCard
          title="System latency"
          value={latencyValue}
          subtitle={latencySubtitle}
          chart={
            <div className="flex w-full items-center justify-center rounded-xl border border-border bg-[#f8fafc] p-3">
              <LatencySparkline samples={latencyMetrics?.samples ?? []} />
            </div>
          }
          footer={
            <Link
              href={`/dashboard/${id}/activity`}
              className="text-xs font-medium text-primary hover:underline"
            >
              Full metrics on Call activity →
            </Link>
          }
        />
        <MetricCard
          title="Appointments booked"
          value={appointments.length}
          subtitle={`${conversations.length} AI conversations`}
          chart={
            <MiniBarChart
              labels={appointmentChart.labels}
              values={appointmentChart.values}
              className="h-[120px] w-full"
            />
          }
          footer={
            <Link
              href={`/dashboard/${id}/appointments`}
              className="text-xs font-medium text-primary hover:underline"
            >
              Manage appointments →
            </Link>
          }
        />
      </section>

      <section className="overview-details-grid">
        <OverviewBusinessCard
          business={business}
          created={created}
          updated={updated}
          businessId={id}
        />
        <StaffSchedulesCard
          members={members}
          businessId={id}
          loading={membersLoading}
        />
      </section>
    </div>
  );
}
