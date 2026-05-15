"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  getGoogleCalendarConnectUrl,
  getOutlookCalendarConnectUrl,
  listBusinessCalendars,
} from "@/lib/api";
import type { CalendarIntegration } from "@/lib/api";

export default function BusinessCalendarsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const businessId = Number(id);

  const [calendars, setCalendars] = useState<CalendarIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState<"google" | "outlook" | null>(null);

  const loadCalendars = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await listBusinessCalendars(businessId);
      setCalendars(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load calendars");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    loadCalendars();
  }, [businessId, router, loadCalendars]);

  async function handleConnectGoogle() {
    setConnecting("google");
    setError("");
    try {
      const { authorization_url } = await getGoogleCalendarConnectUrl(businessId);
      window.location.href = authorization_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start Google Calendar connect");
      setConnecting(null);
    }
  }

  async function handleConnectOutlook() {
    setConnecting("outlook");
    setError("");
    try {
      const { authorization_url } = await getOutlookCalendarConnectUrl(businessId);
      window.location.href = authorization_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start Outlook calendar connect");
      setConnecting(null);
    }
  }

  return (
    <div>
      <Link
        href={`/dashboard/${id}`}
        className="mb-4 inline-block text-sm text-muted-foreground hover:underline"
      >
        ← Back to business
      </Link>

      <div className="rounded-xl border border-border bg-card p-6">
        <h1 className="text-xl font-semibold text-foreground">Calendars</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect Google or Outlook so the app can sync events and check availability.
        </p>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            {calendars.length > 0 && (
              <div className="mt-4">
                <h2 className="text-sm font-medium text-foreground">Connected calendars</h2>
                <ul className="mt-2 space-y-2">
                  {calendars.map((cal) => (
                    <li
                      key={cal.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-muted/15 px-3 py-2"
                    >
                      <span className="text-sm font-medium text-foreground capitalize">
                        {cal.provider}
                        {cal.is_primary && (
                          <span className="ml-2 text-xs text-muted-foreground">(primary)</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {cal.sync_enabled ? "Sync on" : "Sync off"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6">
              <h2 className="text-sm font-medium text-foreground">Add a calendar</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                You’ll be redirected to sign in and grant access. After connecting, you’ll return
                here.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={connecting !== null}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/20 disabled:opacity-50"
                >
                  {connecting === "google" ? "Redirecting…" : "Connect Google Calendar"}
                </button>
                <button
                  type="button"
                  onClick={handleConnectOutlook}
                  disabled={connecting !== null}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/20 disabled:opacity-50"
                >
                  {connecting === "outlook" ? "Redirecting…" : "Connect Outlook Calendar"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
