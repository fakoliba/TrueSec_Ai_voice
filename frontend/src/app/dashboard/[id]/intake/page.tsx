"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function IntakeHubPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <div>
      <Link href={`/dashboard/${id}`} className="mb-4 inline-block text-sm text-primary hover:underline">
        ← Back to overview
      </Link>
      <h1 className="text-xl font-bold text-foreground">Customer intake</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Build registration forms and review submissions. Set the default form for the AI under Settings.
      </p>
      <ul className="mt-8 space-y-3">
        <li>
          <Link
            href={`/dashboard/${id}/intake/forms`}
            className="block rounded-xl border border-border bg-card px-4 py-3 font-medium text-foreground ring-1 ring-border/20 hover:border-primary/40"
          >
            Intake forms
          </Link>
        </li>
        <li>
          <Link
            href={`/dashboard/${id}/intake/submissions`}
            className="block rounded-xl border border-border bg-card px-4 py-3 font-medium text-foreground ring-1 ring-border/20 hover:border-primary/40"
          >
            Submissions
          </Link>
        </li>
      </ul>
    </div>
  );
}
