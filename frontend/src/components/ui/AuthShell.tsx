import type { ReactNode } from "react";

/** Centered auth / marketing card layout with soft gradient background. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-r from-[var(--hero-from)] to-[var(--hero-to)] p-4">
      {children}
    </div>
  );
}
