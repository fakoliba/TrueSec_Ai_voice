"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, getProfile, canCreateBusiness } from "@/lib/api";
import type { Business, UserProfile } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { buttonClasses } from "@/components/ui/Button";
import { ServiceHighlights } from "@/components/ServiceHighlights";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const router = useRouter();
  const redirectSingleRef = useRef(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    redirectSingleRef.current = false;
    Promise.all([
      apiFetch("/api/businesses/", { token }).then((res) => {
        if (res.status === 401) {
          localStorage.removeItem("token");
          router.push("/login");
          return [] as Business[];
        }
        if (!res.ok) throw new Error("Failed to load businesses");
        return res.json() as Promise<Business[]>;
      }),
      getProfile().catch(() => null as UserProfile | null),
    ])
      .then(([data, user]) => {
        const list = data || [];
        if (list.length === 1) {
          redirectSingleRef.current = true;
          router.replace(`/dashboard/${list[0].id}`);
          return;
        }
        setBusinesses(list);
        setProfile(user ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error"))
      .finally(() => {
        if (!redirectSingleRef.current) {
          setLoading(false);
        }
      });
  }, [router]);

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[40vh] w-full max-w-6xl items-center justify-center px-6 py-6">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const allowCreate = canCreateBusiness(profile);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6">
      <ServiceHighlights />

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">My businesses</h1>
          <p className="mt-1 text-sm text-muted-foreground">Open a business to manage calendars, team, and voice.</p>
        </div>
        {allowCreate ? (
          <Link href="/dashboard/new" className={cn(buttonClasses("primary", "sm"), "font-semibold shadow-md shadow-primary/15")}>
            Create business
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">
            Contact your administrator to create a new business.
          </p>
        )}
      </div>
      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>
      )}
      {businesses.length === 0 && !error ? (
        <Card className="p-10 text-center text-muted-foreground">
          <p className="font-medium text-foreground">You don’t have any businesses yet.</p>
          {allowCreate ? (
            <>
              <p className="mt-2 text-sm">Create your first business to get started.</p>
              <Link
                href="/dashboard/new"
                className={cn(buttonClasses("primary", "md"), "mt-6 inline-flex font-semibold shadow-md shadow-primary/15")}
              >
                Create business
              </Link>
            </>
          ) : (
            <p className="mt-2 text-sm">Contact your administrator to create a new business.</p>
          )}
        </Card>
      ) : (
        <ul className="space-y-3">
          {businesses.map((b) => (
            <li key={b.id}>
              <Link
                href={`/dashboard/${b.id}`}
                className="block rounded-2xl border border-border bg-card p-5 shadow-sm ring-1 ring-border/20 transition hover:border-primary/25 hover:shadow-md hover:shadow-primary/5"
              >
                <span className="font-semibold text-foreground">{b.name}</span>
                {b.business_type && (
                  <span className="ml-2 text-sm text-muted-foreground">{b.business_type}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link href="/" className="font-medium text-primary hover:underline">
          ← Home
        </Link>
      </p>
    </div>
  );
}
