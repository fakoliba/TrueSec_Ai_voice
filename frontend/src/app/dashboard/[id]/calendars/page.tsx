"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getGoogleCalendarConnectUrl,
  getOutlookCalendarConnectUrl,
  listBusinessCalendars,
} from "@/lib/api";
import type { CalendarIntegration } from "@/lib/api";
import { BusinessPageShell } from "@/components/dashboard/BusinessPageShell";
import { SyncedCalendarView } from "@/components/dashboard/SyncedCalendarView";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google Calendar",
  outlook: "Outlook",
  apple: "Apple Calendar",
};

function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider.toLowerCase()] ?? provider;
}

export default function BusinessCalendarsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const businessId = Number(id);

  const [calendars, setCalendars] = useState<CalendarIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState<"google" | "outlook" | null>(null);
  const isSynced = calendars.length > 0;
  const primaryCalendar = useMemo(
    () => calendars.find((c) => c.is_primary) ?? calendars[0],
    [calendars],
  );

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
    <BusinessPageShell
      section="Calendar"
      title="Calendars"
      description="Connect Google or Outlook so the app can sync events and check availability."
      contentClassName="max-w-5xl"
    >
      <div className="space-y-6">
        <Card className="p-6 sm:p-8">
          {error && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading calendar settings…</p>
          ) : (
            <div className="space-y-8">
              {isSynced && (
                <div>
                  <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground sm:text-left">
                    Connected
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {calendars.map((cal) => (
                      <li
                        key={cal.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-[#f8fafc] px-4 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold uppercase",
                              cal.provider === "google" && "bg-white text-[#4285F4] ring-1 ring-border",
                              cal.provider === "outlook" && "bg-[#0078d4] text-white",
                              cal.provider !== "google" &&
                                cal.provider !== "outlook" &&
                                "bg-primary/15 text-primary",
                            )}
                            aria-hidden
                          >
                            {cal.provider.slice(0, 2)}
                          </span>
                          <div className="min-w-0 text-left">
                            <p className="text-sm font-medium text-foreground">
                              {providerLabel(cal.provider)}
                              {cal.is_primary && (
                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                  (primary)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {cal.sync_enabled ? "Sync enabled" : "Sync paused"}
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
                          Active
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div
                className={cn(
                  "text-center sm:text-left",
                  isSynced && "border-t border-border pt-8",
                )}
              >
                <h2 className="text-lg font-semibold text-foreground">
                  {isSynced ? "Connect another calendar" : "Add a calendar"}
                </h2>
                <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:mx-0">
                  You&apos;ll be redirected to sign in and grant access. After connecting, you&apos;ll
                  return here and your events will appear in the calendar below.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3 sm:justify-start">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleConnectGoogle}
                    disabled={connecting !== null}
                    className="min-w-[200px]"
                  >
                    {connecting === "google" ? "Redirecting…" : "Connect Google Calendar"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleConnectOutlook}
                    disabled={connecting !== null}
                    className="min-w-[200px]"
                  >
                    {connecting === "outlook" ? "Redirecting…" : "Connect Outlook Calendar"}
                  </Button>
                </div>
              </div>

              {!isSynced && (
                <p className="rounded-xl border border-dashed border-border bg-[#f8fafc] px-4 py-6 text-center text-sm text-muted-foreground">
                  No calendar connected yet. Connect Google or Outlook above to see your schedule here.
                </p>
              )}
            </div>
          )}
        </Card>

        {isSynced && !loading && (
          <SyncedCalendarView
            businessId={businessId}
            providerLabel={
              primaryCalendar ? providerLabel(primaryCalendar.provider) : undefined
            }
          />
        )}
      </div>
    </BusinessPageShell>
  );
}
