"use client";

import { useParams } from "next/navigation";
import BusinessNav from "@/components/BusinessNav";
import { DashboardThemeProvider } from "@/components/DashboardThemeProvider";
import SuperAdminBanner from "@/components/SuperAdminBanner";

export default function BusinessSegmentLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const id = params.id as string;

  return (
    <DashboardThemeProvider businessId={id}>
      <div className="flex w-full flex-col md:min-h-[calc(100vh-3.5rem)] md:flex-row md:items-start">
        <div className="flex min-w-0 flex-1 flex-col">
          <SuperAdminBanner />
          <div className="flex w-full flex-1 flex-col md:flex-row md:items-start">
            <BusinessNav businessId={id} />
            <div className="min-w-0 w-full flex-1 px-6 py-6 md:min-h-0">{children}</div>
          </div>
        </div>
      </div>
    </DashboardThemeProvider>
  );
}
