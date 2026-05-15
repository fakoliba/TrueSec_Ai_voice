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
    <div className="border-b border-amber-500/30 bg-amber-950/40 px-4 py-2 text-center text-sm text-amber-100">
      <span className="font-medium">Viewing as platform admin</span>
      {" · "}
      <Link href="/platform" className="underline underline-offset-2 hover:text-white">
        Back to platform
      </Link>
    </div>
  );
}
