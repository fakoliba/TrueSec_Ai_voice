"use client";

import { useState } from "react";
import { maskEmail, maskPhone } from "@/lib/phi-display";
import { cn } from "@/lib/utils";

type PhiRevealProps = {
  value: string;
  kind: "phone" | "email" | "text";
  className?: string;
};

/** Click-to-reveal masked PHI for list views (HIPAA minimum necessary). */
export function PhiReveal({ value, kind, className }: PhiRevealProps) {
  const [revealed, setRevealed] = useState(false);
  const trimmed = value.trim();
  if (!trimmed) return <span className={className}>—</span>;

  const masked =
    kind === "phone" ? maskPhone(trimmed) : kind === "email" ? maskEmail(trimmed) : "••••••";

  return (
    <button
      type="button"
      onClick={() => setRevealed((r) => !r)}
      className={cn(
        "text-left font-mono text-sm text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        className,
      )}
      title={revealed ? "Click to hide" : "Click to reveal"}
      aria-label={revealed ? "Hide sensitive value" : "Reveal sensitive value"}
    >
      {revealed ? trimmed : masked}
    </button>
  );
}
