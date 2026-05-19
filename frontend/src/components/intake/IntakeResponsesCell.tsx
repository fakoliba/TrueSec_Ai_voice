"use client";

import { useState } from "react";
import { formatIntakeResponsePreview } from "@/lib/phi-display";

type IntakeResponsesCellProps = {
  responses: unknown;
};

/** Avoid dumping full intake JSON in table cells; expand on demand. */
export function IntakeResponsesCell({ responses }: IntakeResponsesCellProps) {
  const [open, setOpen] = useState(false);
  const preview = formatIntakeResponsePreview(responses);

  if (responses == null) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="max-w-md">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-medium text-primary hover:underline"
      >
        {open ? "Hide responses" : `View ${preview}`}
      </button>
      {open && (
        <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-border bg-[#f8fafc] p-2 font-mono text-[11px] text-foreground whitespace-pre-wrap">
          {JSON.stringify(responses, null, 2)}
        </pre>
      )}
    </div>
  );
}
