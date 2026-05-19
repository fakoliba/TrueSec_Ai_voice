"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listAllPlatformBusinesses } from "@/lib/api";
import type { Business } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { inputClassName } from "@/lib/utils";

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function PlatformHomePage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    listAllPlatformBusinesses()
      .then(setBusinesses)
      .catch((err) => {
        if (err instanceof Error && err.message === "Not authenticated") {
          router.push("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load businesses");
      })
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return businesses;
    return businesses.filter((b) => {
      const hay = [b.name, b.business_type, b.subscription_plan, b.subscription_status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(s);
    });
  }, [businesses, q]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">All businesses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Platform view — open any tenant dashboard as a super user.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/platform/onboard"
            className={cn(buttonClasses("primary", "sm"), "font-semibold shadow-md shadow-primary/15")}
          >
            Onboard business
          </Link>
          <Link href="/platform/users" className={buttonClasses("secondary", "sm")}>
            Platform users
          </Link>
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="platform-search" className="sr-only">
          Search businesses
        </label>
        <input
          id="platform-search"
          type="search"
          placeholder="Search by name, type, plan…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={inputClassName + " max-w-md"}
        />
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {filtered.length === 0 && !error ? (
        <Card className="p-10 text-center text-muted-foreground">
          <p className="font-medium text-foreground">No businesses yet</p>
          <p className="mt-2 text-sm">Create the first tenant from the platform console.</p>
          <Link
            href="/platform/onboard"
            className={cn(buttonClasses("primary", "md"), "mt-6 inline-flex font-semibold shadow-md shadow-primary/15")}
          >
            Onboard business
          </Link>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-b border-border/80 last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium text-foreground">{b.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{b.business_type || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{b.subscription_plan || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{b.subscription_status || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(b.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/${b.id}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Open
                    </Link>
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
