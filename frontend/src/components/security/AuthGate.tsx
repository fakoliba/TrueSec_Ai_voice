"use client";

import type { ReactNode } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";

type AuthGateProps = {
  children: ReactNode;
  redirectTo?: string;
  fallback?: ReactNode;
};

/** Renders children only after auth token is verified (client-side). */
export function AuthGate({ children, redirectTo, fallback = null }: AuthGateProps) {
  const authed = useRequireAuth(redirectTo);
  if (!authed) return <>{fallback}</>;
  return <>{children}</>;
}
