"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { getProfile, isSuperAdmin } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-session";
import type { UserProfile } from "@/lib/api";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    getProfile()
      .then((p: UserProfile) => {
        if (!isSuperAdmin(p)) {
          router.replace("/dashboard");
          return;
        }
        setReady(true);
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [router]);

  if (!ready) {
    return (
      <div className="dashboard-app-shell flex min-h-screen flex-col">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-6 py-12">
          <p className="text-muted-foreground">Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-app-shell flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 md:px-8">{children}</main>
    </div>
  );
}
