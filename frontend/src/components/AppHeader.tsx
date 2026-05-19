"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getProfile, isSuperAdmin } from "@/lib/api";
import { clearSession, getAccessToken } from "@/lib/auth-session";
import type { UserProfile } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setProfile(null);
      return;
    }
    getProfile()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [pathname]);

  function handleSignOut() {
    clearSession();
    router.push("/");
    router.refresh();
  }

  const linkBase =
    "rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";
  const active = "bg-white/14 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]";
  const inactive = "text-sidebar-foreground/85 hover:bg-white/10 hover:text-white";

  return (
    <header className="sticky top-0 z-30 border-b border-sidebar-border bg-sidebar text-sidebar-foreground shadow-md">
      <div className="mx-auto flex h-[3.75rem] w-full max-w-none items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6 sm:gap-8">
          <Link
            href="/dashboard"
            className="text-base font-semibold tracking-tight text-white transition-opacity hover:opacity-90"
          >
            true<span className="text-[#d4af37]">Sec</span>
            <span className="font-normal text-white/95">.AI</span>
          </Link>
          <nav className="flex items-center gap-0.5 sm:gap-1" aria-label="Main">
            <Link
              href="/dashboard"
              className={cn(linkBase, pathname === "/dashboard" ? active : inactive)}
            >
              Dashboard
            </Link>
            {isSuperAdmin(profile) && (
              <Link
                href="/platform"
                className={cn(
                  linkBase,
                  pathname?.startsWith("/platform") ? active : inactive,
                )}
              >
                Platform
              </Link>
            )}
            <Link
              href="/account"
              className={cn(linkBase, pathname?.startsWith("/account") ? active : inactive)}
            >
              Account
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm font-semibold text-white sm:flex"
            aria-hidden={!profile}
            title={profile?.full_name || profile?.email || "Account"}
          >
            {(profile?.full_name || profile?.email || "U").charAt(0).toUpperCase()}
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-sidebar-foreground/90 transition-all duration-200 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
