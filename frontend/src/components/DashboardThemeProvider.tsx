"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getBusinessSettings } from "@/lib/api";
import type { DashboardTheme } from "@/lib/api";

type DashboardThemeContextValue = {
  theme: DashboardTheme;
  refreshTheme: () => Promise<void>;
};

const DashboardThemeContext = createContext<DashboardThemeContextValue | null>(null);

export function useDashboardTheme(): DashboardThemeContextValue {
  const ctx = useContext(DashboardThemeContext);
  if (!ctx) {
    throw new Error("useDashboardTheme must be used within DashboardThemeProvider");
  }
  return ctx;
}

export function DashboardThemeProvider({
  businessId,
  children,
}: {
  businessId: string;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<DashboardTheme>("gold");

  const refreshTheme = useCallback(async () => {
    const id = Number(businessId);
    if (Number.isNaN(id)) return;
    try {
      const s = await getBusinessSettings(id);
      setTheme(s.dashboard_theme === "emerald" ? "emerald" : "gold");
    } catch {
      setTheme("gold");
    }
  }, [businessId]);

  useEffect(() => {
    void refreshTheme();
  }, [refreshTheme]);

  const value = useMemo(
    () => ({ theme, refreshTheme }),
    [theme, refreshTheme],
  );

  return (
    <DashboardThemeContext.Provider value={value}>
      <div
        className="dashboard-theme-root flex min-h-full w-full flex-1 flex-col bg-background text-foreground"
        data-dashboard-theme={theme}
      >
        {children}
      </div>
    </DashboardThemeContext.Provider>
  );
}
