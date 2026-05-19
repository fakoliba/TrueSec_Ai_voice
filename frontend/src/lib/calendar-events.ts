/** Normalized calendar event for UI (Google / Outlook raw payloads). */
export type CalendarEventItem = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
};

type DateTimeField = { dateTime?: string; date?: string; timeZone?: string };

function parseStartEnd(raw: Record<string, unknown>): Pick<CalendarEventItem, "start" | "end" | "allDay"> | null {
  const startObj = raw.start as DateTimeField | undefined;
  const endObj = raw.end as DateTimeField | undefined;
  if (!startObj) return null;

  const allDay = Boolean(startObj.date && !startObj.dateTime);
  const startStr = startObj.dateTime ?? startObj.date;
  const endStr = endObj?.dateTime ?? endObj?.date ?? startStr;
  if (!startStr) return null;

  const start = new Date(startStr);
  const end = new Date(endStr ?? startStr);
  if (Number.isNaN(start.getTime())) return null;

  return { start, end: Number.isNaN(end.getTime()) ? start : end, allDay };
}

/** Parse a provider event object into a normalized item, or null if unrecognized. */
export function parseCalendarEvent(raw: Record<string, unknown>): CalendarEventItem | null {
  const id = String(raw.id ?? raw.iCalUID ?? raw.uid ?? Math.random());
  const parsed = parseStartEnd(raw);
  if (!parsed) return null;

  // Google Calendar API
  if (raw.summary !== undefined) {
    return {
      id,
      title: String(raw.summary || "(No title)"),
      ...parsed,
    };
  }

  // Microsoft Graph
  if (raw.subject !== undefined) {
    return {
      id,
      title: String(raw.subject || "(No title)"),
      ...parsed,
    };
  }

  return null;
}

export function parseCalendarEvents(rawList: unknown[]): CalendarEventItem[] {
  const out: CalendarEventItem[] = [];
  for (const raw of rawList) {
    if (raw && typeof raw === "object") {
      const item = parseCalendarEvent(raw as Record<string, unknown>);
      if (item) out.push(item);
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** Six-week grid starting Sunday. */
export function getMonthGridDays(month: Date): Date[] {
  const first = startOfMonth(month);
  const start = new Date(first);
  start.setDate(start.getDate() - start.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function eventsOnDay(events: CalendarEventItem[], day: Date): CalendarEventItem[] {
  return events.filter((e) => isSameDay(e.start, day));
}

export function formatEventTime(event: CalendarEventItem): string {
  if (event.allDay) return "All day";
  return event.start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
