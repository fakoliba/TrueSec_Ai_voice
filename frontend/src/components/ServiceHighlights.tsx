import { Card } from "@/components/ui/Card";

/**
 * Static product context for logged-in business users — used on Overview and the business list dashboard.
 */
export function ServiceHighlights() {
  return (
    <Card className="mb-8 border-border/80 bg-gradient-to-br from-card via-[#f8fafc] to-card">
      <h2 className="text-base font-semibold tracking-tight text-foreground">
        true<span className="text-primary">Sec</span>AI for your business
      </h2>
      <p className="dashboard-hint mt-2 text-sm leading-relaxed">
        Your AI receptionist answers voice calls, books appointments, and logs conversations—track
        call volume, latency, and AI handling on each business overview.
      </p>
    </Card>
  );
}
