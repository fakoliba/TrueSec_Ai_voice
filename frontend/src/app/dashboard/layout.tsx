"use client";

import AppHeader from "@/components/AppHeader";
import { AuthGate } from "@/components/security/AuthGate";

export default function DashboardLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <div className="dashboard-app-shell flex min-h-screen flex-col">
      <AppHeader />
      <main className="w-full flex-1">
        <AuthGate>{children}</AuthGate>
      </main>
    </div>
  );
}
