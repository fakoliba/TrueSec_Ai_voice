"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useBusinessLayout } from "@/components/dashboard/BusinessLayoutContext";

type BusinessPageShellProps = {
  section: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function BusinessPageShell({
  section,
  title,
  description,
  children,
  className,
  contentClassName,
}: BusinessPageShellProps) {
  const { businessId, businessName } = useBusinessLayout();

  return (
    <div className={cn("dashboard-page w-full", className)}>
      <nav
        className="dashboard-breadcrumb mb-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-3 text-center text-sm sm:justify-start sm:text-left"
        aria-label="Breadcrumb"
      >
        <Link href="/dashboard" className="font-medium hover:text-primary">
          Dashboard
        </Link>
        <span className="text-border">/</span>
        {businessName ? (
          <>
            <Link
              href={`/dashboard/${businessId}`}
              className="font-medium text-foreground/80 hover:text-primary"
            >
              {businessName}
            </Link>
            <span className="text-border">/</span>
          </>
        ) : null}
        <span className="font-semibold text-primary">{section}</span>
      </nav>

      <header className="mb-8 text-center sm:mb-10 sm:text-left">
        <h1>{title}</h1>
        {description ? (
          <p className="mx-auto mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:mx-0">
            {description}
          </p>
        ) : null}
      </header>

      <div className={cn("dashboard-page-body mx-auto w-full", contentClassName)}>{children}</div>
    </div>
  );
}
