"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth-session";

/**
 * Redirects unauthenticated users. Reads token synchronously on first render to avoid redirect loops after login.
 */
export function useRequireAuth(redirectTo = "/login"): boolean {
  const router = useRouter();
  const [authed, setAuthed] = useState(() =>
    typeof window !== "undefined" ? Boolean(getAccessToken()) : false,
  );

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace(redirectTo);
      return;
    }
    setAuthed(true);
  }, [router, redirectTo]);

  return authed;
}
