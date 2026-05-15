import { Card } from "@/components/ui/Card";

/**
 * Static product context for logged-in business users — used on Overview and the business list dashboard.
 */
export function ServiceHighlights() {
  return (
    <Card className="mb-6 border-border bg-gradient-to-br from-card via-background/80 to-card p-4 shadow-sm ring-1 ring-border/20 sm:p-5">
      <h2 className="text-sm font-semibold tracking-tight text-foreground">
        true<span className="text-primary">Sec</span>AI for your business
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Manage appointments, connect Google Calendar, let customers reach you by{" "}
        <span className="font-medium text-foreground">AI chat</span> and{" "}
        <span className="font-medium text-foreground">voice</span>, and keep hours &amp; services in
        one place—all scoped to each business you run.
      </p>
    </Card>
  );
}
