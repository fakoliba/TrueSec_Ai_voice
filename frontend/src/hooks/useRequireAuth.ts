"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth-session";

/**
 * Redirects unauthenticated users. Returns false until a token is present (reduces content flash).
 */
export function useRequireAuth(redirectTo = "/login"): boolean {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

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
