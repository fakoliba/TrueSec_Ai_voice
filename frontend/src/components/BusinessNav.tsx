"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Business } from "@/lib/api";

const NAV_COLLAPSED_KEY = "dashboard-business-nav-collapsed";

type NavItem = {
  href: (id: string) => string;
  label: string;
  /** Only this exact path matches (for overview) */
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: (id) => `/dashboard/${id}`, label: "Overview", exact: true },
  { href: (id) => `/dashboard/${id}/calendars`, label: "Calendar" },
  { href: (id) => `/dashboard/${id}/appointments`, label: "Appointments" },
  { href: (id) => `/dashboard/${id}/customers`, label: "Customers" },
  { href: (id) => `/dashboard/${id}/team`, label: "Team & users" },
  { href: (id) => `/dashboard/${id}/activity`, label: "Call activity" },
  { href: (id) => `/dashboard/${id}/voice`, label: "Voice configuration" },
  { href: (id) => `/dashboard/${id}/intake`, label: "Intake" },
  { href: (id) => `/dashboard/${id}/settings`, label: "Settings" },
];

/** Inline icons for collapsed rail (24×24, stroke). */
function NavGlyph({ label }: { label: string }) {
  const common = "h-5 w-5 shrink-0";
  switch (label) {
    case "Overview":
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      );
    case "Calendar":
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case "Appointments":
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "Customers":
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      );
    case "Team & users":
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    case "Call activity":
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      );
    case "Voice configuration":
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0-4H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      );
    case "Intake":
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case "Settings":
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    default:
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

function isActive(pathname: string, id: string, item: NavItem): boolean {
  const target = item.href(id);
  if (item.exact) {
    return pathname === target || pathname === `${target}/`;
  }
  return pathname === target || pathname.startsWith(`${target}/`);
}

function NavLinks({
  businessId,
  onNavigate,
  linkClassName,
  collapsed,
}: {
  businessId: string;
  onNavigate?: () => void;
  linkClassName: (active: boolean) => string;
  collapsed?: boolean;
}) {
  const pathname = usePathname() || "";

  return (
    <ul className={`flex flex-col gap-1 ${collapsed ? "items-center" : ""}`}>
      {NAV_ITEMS.map((item) => {
        const href = item.href(businessId);
        const active = isActive(pathname, businessId, item);
        return (
          <li key={item.label} className={collapsed ? "w-full" : undefined}>
            <Link
              href={href}
              className={linkClassName(active)}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
            >
              {collapsed ? (
                <>
                  <span className="sr-only">{item.label}</span>
                  <NavGlyph label={item.label} />
                </>
              ) : (
                item.label
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function BusinessNav({ businessId }: { businessId: string }) {
  const [open, setOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [businessName, setBusinessName] = useState<string>("Business");
  const drawerRef = useRef<HTMLElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(NAV_COLLAPSED_KEY) === "1") setNavCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleNavCollapsed = useCallback(() => {
    setNavCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(NAV_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return;
    apiFetch(`/api/businesses/${businessId}`, { token })
      .then((res) => (res.ok ? res.json() : null))
      .then((b: Business | null) => {
        if (b?.name) setBusinessName(b.name);
      })
      .catch(() => {});
  }, [businessId]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => {
      const first = drawerRef.current?.querySelector<HTMLAnchorElement>("a[href]");
      first?.focus();
    }, 0);
    return () => {
      document.body.style.overflow = "";
      window.clearTimeout(t);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        closeBtnRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const linkClassExpanded = (active: boolean) =>
    `block rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar ${
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-sidebar-foreground/80 hover:bg-white/10 hover:text-sidebar-foreground"
    }`;

  const linkClassCollapsed = (active: boolean) =>
    `flex items-center justify-center rounded-lg p-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar ${
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-sidebar-foreground/80 hover:bg-white/10 hover:text-sidebar-foreground"
    }`;

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-sidebar-border bg-sidebar px-6 pb-4 pt-6 text-sidebar-foreground md:hidden">
        <button
          type="button"
          ref={closeBtnRef}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-sidebar"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="business-nav-drawer"
          aria-label="Open business menu"
        >
          <span className="sr-only">Menu</span>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-sidebar-foreground">
          {businessName}
        </span>
        <span className="w-10" aria-hidden />
      </div>

      <aside
        className={`hidden min-h-[calc(100vh-3.5rem)] shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out md:flex md:flex-col ${
          navCollapsed ? "w-[3.25rem]" : "w-56"
        }`}
        aria-label="Business navigation"
      >
        <div
          className={`sticky top-14 flex max-h-[calc(100vh-3.5rem)] flex-col overflow-y-auto py-6 ${
            navCollapsed ? "items-center px-1" : "pl-4 pr-3"
          }`}
        >
          <div
            className={`mb-3 flex border-b border-sidebar-border pb-2 ${navCollapsed ? "w-full flex-col items-center gap-2" : "items-center gap-2"}`}
          >
            <button
              type="button"
              onClick={toggleNavCollapsed}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar text-sidebar-foreground hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
              aria-expanded={!navCollapsed}
              aria-label={navCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={navCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {navCollapsed ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              )}
            </button>
            {!navCollapsed && (
              <p className="min-w-0 flex-1 truncate px-1 text-xs font-semibold uppercase tracking-wide text-sidebar-accent">
                {businessName}
              </p>
            )}
          </div>
          <nav className="flex-1">
            <NavLinks
              businessId={businessId}
              linkClassName={navCollapsed ? linkClassCollapsed : linkClassExpanded}
              collapsed={navCollapsed}
            />
          </nav>
        </div>
      </aside>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            aria-label="Close menu"
            onClick={close}
          />
          <aside
            ref={drawerRef}
            id="business-nav-drawer"
            className="fixed left-0 top-0 z-50 flex h-full w-[min(20rem,85vw)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Business menu"
          >
            <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3">
              <span className="truncate font-semibold text-sidebar-foreground">{businessName}</span>
              <button
                type="button"
                className="rounded-lg p-2 text-sidebar-foreground/80 hover:bg-white/10"
                onClick={close}
                aria-label="Close menu"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              <NavLinks
                businessId={businessId}
                onNavigate={close}
                linkClassName={linkClassExpanded}
                collapsed={false}
              />
            </nav>
          </aside>
        </>
      )}
    </>
  );
}
