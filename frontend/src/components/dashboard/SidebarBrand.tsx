import Link from "next/link";

export function SidebarBrand({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link
      href="/dashboard"
      className={`mb-6 flex items-center gap-2.5 transition-opacity hover:opacity-90 ${collapsed ? "justify-center px-0" : "px-1"}`}
      title="trueSecAI"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#d4af37] to-[#b8941f] shadow-md shadow-black/20"
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#0b1f4d]" fill="currentColor">
          <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm0 2.18l6 2.25v4.66c0 3.87-2.55 7.45-6 8.47-3.45-1.02-6-4.6-6-8.47V6.43l6-2.25z" />
        </svg>
      </span>
      {!collapsed && (
        <span className="text-base font-semibold tracking-tight text-white">
          true<span className="text-[#d4af37]">Sec</span>
          <span className="font-normal text-white/90">.AI</span>
        </span>
      )}
    </Link>
  );
}
