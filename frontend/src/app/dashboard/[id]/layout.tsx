"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import BusinessNav from "@/components/BusinessNav";
import { DashboardThemeProvider } from "@/components/DashboardThemeProvider";
import { BusinessLayoutProvider } from "@/components/dashboard/BusinessLayoutContext";
import SuperAdminBanner from "@/components/SuperAdminBanner";
import { apiFetch } from "@/lib/api";
import type { Business } from "@/lib/api";
import { AuthGate } from "@/components/security/AuthGate";
import { getAccessToken } from "@/lib/auth-session";

export default function BusinessSegmentLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const id = params.id as string;
  const [businessName, setBusinessName] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    apiFetch(`/api/businesses/${id}`, { token })
      .then((res) => (res.ok ? res.json() : null))
      .then((b: Business | null) => {
        if (b?.name) setBusinessName(b.name);
      })
      .catch(() => {});
  }, [id]);

  return (
    <DashboardThemeProvider businessId={id}>
      <BusinessLayoutProvider businessId={id} businessName={businessName}>
        <div className="flex w-full flex-col md:min-h-[calc(100vh-3.75rem)] md:flex-row md:items-stretch">
          <div className="flex min-w-0 flex-1 flex-col">
            <SuperAdminBanner />
            <div className="flex w-full flex-1 flex-col md:flex-row md:items-stretch">
              <BusinessNav businessId={id} />
              <div className="min-w-0 w-full flex-1 px-5 py-7 sm:px-7 sm:py-8 md:min-h-0 lg:px-9">
                <div className="mx-auto w-full max-w-[1400px]">
                  <AuthGate>{children}</AuthGate>
                </div>
              </div>
            </div>
          </div>
        </div>
      </BusinessLayoutProvider>
    </DashboardThemeProvider>
  );
}
