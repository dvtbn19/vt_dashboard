"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/lab", label: "Overview", icon: "M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z" },
  { href: "/lab/projects", label: "Projects", icon: "M3 7h18M3 12h18M3 17h12" },
  { href: "/lab/settings", label: "Agent tokens", icon: "M15 7a4 4 0 1 1-3.9 5H3v3h3v3h3v-3h2.1A4 4 0 0 1 15 7z" },
];

function active(path: string, href: string) {
  return href === "/lab" ? path === "/lab" : path === href || path.startsWith(href + "/") || (href === "/lab/projects" && path.startsWith("/lab/runs"));
}

function Icon({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function SideNav() {
  const path = usePathname();
  return (
    <nav aria-label="Lab" className="flex flex-col gap-1">
      {ITEMS.map((it) => {
        const on = active(path, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={on ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] ${on ? "bg-sunken font-semibold text-ink" : "text-muted hover:bg-sunken hover:text-ink"}`}
          >
            <Icon d={it.icon} />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Lab"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {ITEMS.map((it) => {
        const on = active(path, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={on ? "page" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[12px] ${on ? "font-semibold text-accent" : "text-muted"}`}
          >
            <Icon d={it.icon} />
            {it.label === "Agent tokens" ? "Tokens" : it.label}
          </Link>
        );
      })}
    </nav>
  );
}
