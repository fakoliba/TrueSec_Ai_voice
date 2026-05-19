"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { listIntakeSubmissions } from "@/lib/api";
import type { IntakeSubmissionWithFormName } from "@/lib/api";
import { IntakeResponsesCell } from "@/components/intake/IntakeResponsesCell";

export default function IntakeSubmissionsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const businessId = Number(id);
  const [subs, setSubs] = useState<IntakeSubmissionWithFormName[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await listIntakeSubmissions(businessId, {
        status: statusFilter || undefined,
      });
      setSubs(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [businessId, statusFilter]);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    void load();
  }, [router, load]);

  return (
    <div>
      <Link href={`/dashboard/${id}/intake`} className="mb-4 inline-block text-sm text-primary hover:underline">
        ← Intake
      </Link>
      <h1 className="text-xl font-bold text-foreground">Intake submissions</h1>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="text-sm text-muted-foreground">Status</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground"
        >
          <option value="">All</option>
          <option value="draft">draft</option>
          <option value="pending">pending</option>
          <option value="reviewed">reviewed</option>
          <option value="archived">archived</option>
        </select>
      </div>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : subs.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No submissions yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">Form</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Submitted</th>
                <th className="py-2">Responses</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-b border-border/60">
                  <td className="py-2 pr-4 font-mono text-xs">{s.id}</td>
                  <td className="py-2 pr-4">{s.form_name ?? `#${s.intake_form_id}`}</td>
                  <td className="py-2 pr-4 capitalize">{s.status}</td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {new Date(s.submitted_at).toLocaleString()}
                  </td>
                  <td className="py-2">
                    <IntakeResponsesCell responses={s.responses} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
