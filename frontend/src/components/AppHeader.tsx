"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { getProfile, isSuperAdmin } from "@/lib/api";
import type { UserProfile } from "@/lib/api";

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setProfile(null);
      return;
    }
    getProfile()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [pathname]);

  function handleSignOut() {
    if (typeof window !== "undefined") localStorage.removeItem("token");
    router.push("/");
    router.refresh();
  }

  const linkBase =
    "text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md px-1 py-0.5";
  const active = "text-primary";
  const inactive = "text-muted-foreground hover:text-foreground";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-none items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/dashboard"
            className="text-sm font-bold tracking-tight text-foreground"
          >
            true<span className="text-primary">Sec</span>AI
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
            <Link
              href="/dashboard"
              className={`${linkBase} ${pathname === "/dashboard" ? active : inactive}`}
            >
              Dashboard
            </Link>
            {isSuperAdmin(profile) && (
              <Link
                href="/platform"
                className={`${linkBase} ${pathname?.startsWith("/platform") ? active : inactive}`}
              >
                Platform
              </Link>
            )}
            <Link
              href="/account"
              className={`${linkBase} ${pathname?.startsWith("/account") ? active : inactive}`}
            >
              Account
            </Link>
          </nav>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
