import Link from "next/link";
import type { BusinessMember } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { MiniBarChart } from "@/components/dashboard/charts";

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 1) return "Today";
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  } catch {
    return "—";
  }
}

function initials(name?: string | null, email?: string | null): string {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

type StaffSchedulesCardProps = {
  members: BusinessMember[];
  businessId: string;
  loading?: boolean;
};

export function StaffSchedulesCard({ members, businessId, loading }: StaffSchedulesCardProps) {
  const chartLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const chartValues =
    members.length > 0
      ? chartLabels.map((_, i) => Math.max(1, members.length + (i % 3)))
      : [3, 5, 4, 6, 5, 4];

  return (
    <Card className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Staff Schedules</h2>
          <p className="mt-0.5 text-2xl font-bold text-foreground">{members.length}</p>
          <p className="text-xs text-muted-foreground">Team members</p>
        </div>
        <Link
          href={`/dashboard/${businessId}/team`}
          className="text-xs font-medium text-primary hover:underline"
        >
          Manage →
        </Link>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="flex items-end justify-center rounded-xl bg-gradient-to-br from-[#f0fdf4] to-transparent p-2">
          <MiniBarChart labels={chartLabels} values={chartValues} className="h-[100px] w-full max-w-[200px]" />
        </div>

        <div>
          <div className="mb-2 flex gap-4 border-b border-border text-xs font-medium text-muted-foreground">
            <span className="border-b-2 border-primary pb-2 text-foreground">Team</span>
            <Link href={`/dashboard/${businessId}/calendars`} className="pb-2 hover:text-foreground">
              Calendar
            </Link>
            <Link href={`/dashboard/${businessId}/appointments`} className="pb-2 hover:text-foreground">
              Events
            </Link>
          </div>
          {loading ? (
            <p className="py-4 text-sm text-muted-foreground">Loading team…</p>
          ) : members.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No team members yet.</p>
          ) : (
            <ul className="max-h-[180px] space-y-1 overflow-y-auto pr-1">
              {members.slice(0, 6).map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-background/80"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {initials(m.user_full_name, m.user_email)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {m.user_full_name || m.user_email || "Team member"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground capitalize">
                      {m.role}
                      {m.created_at ? ` · ${relativeTime(m.created_at)}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
