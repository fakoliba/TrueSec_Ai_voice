"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { Business } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { ServiceHighlights } from "@/components/ServiceHighlights";

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

export default function BusinessDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    apiFetch(`/api/businesses/${id}`, { token })
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        if (!res.ok) throw new Error("Failed to load business");
        return res.json();
      })
      .then((b: Business | null) => {
        if (b) setBusiness(b);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error"))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (error || !business) {
    return (
      <div>
        <p className="text-red-600">{error || "Not found"}</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground hover:underline">
          ← Back to businesses
        </Link>
      </div>
    );
  }

  const created = formatDate(business.created_at);
  const updated = formatDate(business.updated_at);
  const hasSubscription =
    (business.subscription_plan && business.subscription_plan.trim() !== "") ||
    (business.subscription_status && business.subscription_status.trim() !== "");

  return (
    <div className="w-full">
      <nav
        className="mb-4 rounded-xl border border-border bg-card/80 px-3 py-2.5 text-sm text-muted-foreground shadow-sm ring-1 ring-border/20"
        aria-label="Breadcrumb"
      >
        <Link href="/dashboard" className="font-medium text-primary hover:underline">
          Dashboard
        </Link>
        <span className="mx-2 text-border">/</span>
        <span className="font-medium text-foreground">{business.name}</span>
        <span className="mx-2 text-border">/</span>
        <span className="font-medium text-primary">Overview</span>
      </nav>

      <ServiceHighlights />

      <div className="w-full">
        <Card className="p-4 shadow-md sm:p-6">
          <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">{business.name}</h1>
          {business.business_type && (
            <p className="mt-0.5 text-sm text-muted-foreground">{business.business_type}</p>
          )}

          <dl className="mt-4 space-y-2 rounded-xl border border-border bg-background/60 p-3 text-sm text-muted-foreground sm:p-4">
            {business.email && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-foreground">Email</dt>
                <dd className="text-foreground">{business.email}</dd>
              </div>
            )}
            {business.phone && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-foreground">Phone</dt>
                <dd className="text-foreground">{business.phone}</dd>
              </div>
            )}
            {business.address && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-foreground">Address</dt>
                <dd className="min-w-0 text-foreground">{business.address}</dd>
              </div>
            )}
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium text-foreground">Timezone</dt>
              <dd className="text-foreground">{business.timezone || "—"}</dd>
            </div>
            {created && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-foreground">Created</dt>
                <dd className="text-foreground">{created}</dd>
              </div>
            )}
            {updated && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-foreground">Last updated</dt>
                <dd className="text-foreground">{updated}</dd>
              </div>
            )}
            {hasSubscription && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-foreground">Plan</dt>
                <dd className="text-foreground">
                  {business.subscription_plan || "—"}
                  {business.subscription_status
                    ? ` · ${business.subscription_status}`
                    : ""}
                </dd>
              </div>
            )}
          </dl>
        </Card>
      </div>
    </div>
  );
}
