"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProfile, isSuperAdmin } from "@/lib/api";
import type { UserProfile } from "@/lib/api";

/** Shown on tenant routes when the viewer is a platform super admin. */
export default function SuperAdminBanner() {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  if (!isSuperAdmin(profile)) return null;

  return (
    <div className="border-b border-border bg-[#eef1f5] px-4 py-2.5 text-center text-sm text-muted-foreground">
      <span className="font-semibold text-foreground/80">Viewing as platform admin</span>
      {" · "}
      <Link href="/platform" className="font-medium text-primary underline underline-offset-2 hover:opacity-80">
        Back to platform
      </Link>
    </div>
  );
}
