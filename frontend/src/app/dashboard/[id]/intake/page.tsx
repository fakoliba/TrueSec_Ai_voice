"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { BusinessPageShell } from "@/components/dashboard/BusinessPageShell";
import { Card } from "@/components/ui/Card";

export default function IntakeHubPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <BusinessPageShell
      section="Intake"
      title="Customer intake"
      description="Build registration forms and review submissions. Set the default form for the AI under Settings."
      contentClassName="max-w-lg"
    >
      <ul className="space-y-3">
        <li>
          <Link href={`/dashboard/${id}/intake/forms`} className="block">
            <Card className="text-center transition hover:border-primary/30 sm:text-left">
              <span className="font-medium text-foreground">Intake forms</span>
              <p className="mt-1 text-xs text-muted-foreground">Create and edit registration forms</p>
            </Card>
          </Link>
        </li>
        <li>
          <Link href={`/dashboard/${id}/intake/submissions`} className="block">
            <Card className="text-center transition hover:border-primary/30 sm:text-left">
              <span className="font-medium text-foreground">Submissions</span>
              <p className="mt-1 text-xs text-muted-foreground">Review customer responses</p>
            </Card>
          </Link>
        </li>
      </ul>
    </BusinessPageShell>
  );
}
