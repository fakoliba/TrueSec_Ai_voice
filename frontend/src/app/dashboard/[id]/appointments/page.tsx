"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

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
    <div className="p-0">
      <div className="mx-auto max-w-2xl">
        <Link href={`/dashboard/${id}`} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
          ← Back to business
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-foreground">Appointments</h1>
        {loading ? (
          <p className="mt-4 text-muted-foreground">Loading…</p>
        ) : appointments.length === 0 ? (
          <p className="mt-4 rounded-xl border border-border bg-card p-6 text-muted-foreground">
            No appointments yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {appointments.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-border bg-card p-4 text-sm text-foreground"
              >
                <span className="font-medium">{new Date(a.start_time).toLocaleString()}</span>
                <span className="ml-2 text-muted-foreground">– {a.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
