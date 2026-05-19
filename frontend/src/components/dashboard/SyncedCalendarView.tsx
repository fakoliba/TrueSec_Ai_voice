"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listBusinessCalendarEvents } from "@/lib/api";
import {
  type CalendarEventItem,
  endOfMonth,
  eventsOnDay,
  formatEventTime,
  getMonthGridDays,
  isSameDay,
  parseCalendarEvents,
  startOfMonth,
} from "@/lib/calendar-events";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type SyncedCalendarViewProps = {
  businessId: number;
  providerLabel?: string;
};

export function SyncedCalendarView({ businessId, providerLabel }: SyncedCalendarViewProps) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const timeMin = startOfMonth(viewMonth).toISOString();
      const timeMax = endOfMonth(viewMonth).toISOString();
      const raw = await listBusinessCalendarEvents(businessId, {
        timeMin,
        timeMax,
        maxResults: 100,
      });
      setEvents(parseCalendarEvents(raw));
    } catch (e) {
      setEvents([]);
      setError(e instanceof Error ? e.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [businessId, viewMonth]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const gridDays = useMemo(() => getMonthGridDays(viewMonth), [viewMonth]);
  const today = useMemo(() => new Date(), []);
  const monthLabel = viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const selectedDayEvents = useMemo(() => {
    const todayEvents = eventsOnDay(events, today);
    return todayEvents.length > 0 ? todayEvents : events.slice(0, 5);
  }, [events, today]);

  function shiftMonth(delta: number) {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-center sm:text-left">
          <h2 className="text-base font-semibold text-foreground">Synced calendar</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {providerLabel
              ? `Showing events from your ${providerLabel} calendar.`
              : "Events from your connected calendar appear below."}
          </p>
        </div>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/25 hover:bg-background"
            aria-label="Previous month"
          >
            ←
          </button>
          <span className="min-w-[10rem] text-center text-sm font-semibold text-foreground">{monthLabel}</span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/25 hover:bg-background"
            aria-label="Next month"
          >
            →
          </button>
          <button
            type="button"
            onClick={() => setViewMonth(startOfMonth(new Date()))}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            Today
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-700 sm:text-left">
          {error}
        </p>
      )}

      <div className="mt-5 overflow-x-auto">
        <div className="grid min-w-[320px] grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
          {WEEKDAYS.map((label) => (
            <div
              key={label}
              className="bg-[#f8fafc] px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {label}
            </div>
          ))}
          {gridDays.map((day) => {
            const inMonth = day.getMonth() === viewMonth.getMonth();
            const isToday = isSameDay(day, today);
            const dayEvents = eventsOnDay(events, day);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[72px] bg-card p-1.5 sm:min-h-[88px] sm:p-2",
                  !inMonth && "bg-[#f8fafc]/80",
                )}
              >
                <span
                  className={cn(
                    "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    isToday && "bg-primary text-primary-foreground",
                    !isToday && inMonth && "text-foreground",
                    !isToday && !inMonth && "text-muted-foreground/70",
                  )}
                >
                  {day.getDate()}
                </span>
                <ul className="space-y-0.5">
                  {dayEvents.slice(0, 2).map((ev) => (
                    <li
                      key={ev.id}
                      className="truncate rounded bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary sm:text-[11px]"
                      title={ev.title}
                    >
                      {ev.title}
                    </li>
                  ))}
                  {dayEvents.length > 2 && (
                    <li className="px-1 text-[10px] text-muted-foreground">+{dayEvents.length - 2} more</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-center text-sm text-muted-foreground">Loading events…</p>
      ) : (
        <div className="mt-6 border-t border-border pt-5">
          <h3 className="text-sm font-semibold text-foreground">
            {eventsOnDay(events, today).length > 0 ? "Today" : "Upcoming"}
          </h3>
          {selectedDayEvents.length === 0 ? (
            <p className="mt-2 text-center text-sm text-muted-foreground sm:text-left">
              No events this month yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {selectedDayEvents.map((ev) => (
                <li
                  key={ev.id}
                  className="flex flex-col gap-0.5 rounded-xl border border-border bg-[#f8fafc] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-medium text-foreground">{ev.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {ev.start.toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    · {formatEventTime(ev)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
