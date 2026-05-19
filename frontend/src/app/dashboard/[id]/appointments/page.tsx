"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { BusinessPageShell } from "@/components/dashboard/BusinessPageShell";
import { Card } from "@/components/ui/Card";

type Appointment = {
  id: number;
  start_time: string;
  end_time: string;
  status: string;
  customer_id?: number;
  service_id?: number;
};

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
      contentClassName="max-w-3xl"
    >
      {loading ? (
        <p className="text-center text-muted-foreground">Loading…</p>
      ) : appointments.length === 0 ? (
        <Card className="text-center">
          <p className="text-muted-foreground">No appointments yet.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {appointments.map((a) => (
            <li key={a.id}>
              <Card className="flex flex-wrap items-center justify-between gap-2 py-4 text-sm">
                <span className="font-medium text-foreground">
                  {new Date(a.start_time).toLocaleString()}
                </span>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium capitalize text-primary">
                  {a.status}
                </span>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </BusinessPageShell>
  );
}
