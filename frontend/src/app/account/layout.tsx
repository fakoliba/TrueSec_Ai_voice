"use client";

import AppHeader from "@/components/AppHeader";
import { AuthGate } from "@/components/security/AuthGate";

export default function AccountLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <div className="dashboard-app-shell flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 md:px-8">
        <AuthGate>{children}</AuthGate>
      </main>
    </div>
  );
}
