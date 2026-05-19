import type { ReactNode } from "react";

/** Centered auth / marketing layout — matches dashboard light theme. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-6">
      {children}
    </div>
  );
}
