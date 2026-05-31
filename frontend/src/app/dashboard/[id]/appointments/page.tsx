"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { BusinessPageShell } from "@/components/dashboard/BusinessPageShell";
import { Card } from "@/components/ui/Card";

type Appointment = {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  source?: string | null;
  customer_id?: number;
  service_id?: number;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AppointmentsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }
    apiFetch(`/api/businesses/${id}/appointments`, { token })
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return [];
        }
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then(setAppointments)
      .catch(() => setAppointments([]))
      .finally(() => setLoading(false));
  }, [id, token, router]);

  if (!token) return null;

  return (
    <BusinessPageShell
      section="Appointments"
      title="Appointments"
      description="View and manage scheduled visits for this business."
      contentClassName="max-w-5xl"
    >
      {loading ? (
        <Card>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="py-2.5 pr-4 font-semibold">Title</th>
                  <th className="py-2.5 pr-4 font-semibold">Start</th>
                  <th className="py-2.5 pr-4 font-semibold">End</th>
                  <th className="py-2.5 pr-4 font-semibold">Status</th>
                  <th className="py-2.5 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody>
                {appointments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      No appointments yet.
                    </td>
                  </tr>
                ) : (
                  appointments.map((a) => (
                    <tr key={a.id} className="border-b border-border/60 last:border-0">
                      <td className="py-3 pr-4 font-medium text-foreground">{a.title}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{formatDateTime(a.start_time)}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{formatDateTime(a.end_time)}</td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium capitalize text-primary">
                          {a.status}
                        </span>
                      </td>
                      <td className="py-3 capitalize text-muted-foreground">{a.source ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </BusinessPageShell>
  );
}
