"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SideNav } from "./LabNav";
import { ThemeToggle } from "./ThemeToggle";
import { signOut } from "@/app/lab/actions";
import { headingElement, scrollToHeading, useNotebookToc } from "@/lib/notebookToc";
import { SIDEBAR_COOKIE } from "@/lib/sidebar";


function Svg({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const ICON = {
  collapse: "M15 6l-6 6 6 6M20 4v16",
  expand: "M9 6l6 6-6 6M4 4v16",
  contents: "M4 6h16M8 12h12M12 18h8",
  signOut: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  portfolio: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
};

/** Headings of the open notebook, with the one in view highlighted. */
function NotebookContents() {
  const toc = useNotebookToc();
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (!toc.length) return;
    const scroller = document.querySelector<HTMLElement>('section[aria-label="SQL"]');
    if (!scroller) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = scroller.getBoundingClientRect().top + 96;
      let idx = 0;
      toc.forEach((t, i) => {
        const el = headingElement(t.cellKey, t.nth);
        if (el && el.getBoundingClientRect().top <= top) idx = i;
      });
      setActive(idx);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [toc]);
  if (!toc.length) {
    return <p className="px-3 text-[13px] leading-snug text-muted">Add a Markdown cell with `#`, `##`, `###` headings to build the contents.</p>;
  }
  const min = Math.min(...toc.map((t) => t.level));
  return (
    <ul className="space-y-0.5">
      {toc.map((t, i) => (
        <li key={`${t.cellKey}-${t.nth}`}>
          <button
            type="button"
            onClick={() => scrollToHeading(t.cellKey, t.nth)}
            aria-current={i === active ? "location" : undefined}
            className={`block w-full truncate rounded-md border-l-2 py-1 pr-2 text-left text-[13.5px] ${
              i === active ? "border-accent bg-sunken font-semibold text-ink" : "border-transparent text-muted hover:bg-sunken hover:text-ink"
            } ${t.level === min ? "" : "text-[13px]"}`}
            style={{ paddingLeft: 10 + (t.level - min) * 12 }}
            title={t.text}
          >
            {t.text}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Desktop sidebar: full (240px) or icons only (64px); the choice is kept in a cookie so the page renders it right away. */
export function LabSidebar({ email, portfolioHref, initialCollapsed }: { email: string | null; portfolioHref: string; initialCollapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const onWorkspace = usePathname().endsWith("/workspace");
  const toggle = (next = !collapsed) => {
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/lab; max-age=31536000; samesite=lax`;
    // Plotly charts follow their container through ResizeObserver; nothing else to do.
  };
  return (
    <aside
      className={`sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface py-5 transition-[width] duration-200 lg:flex ${collapsed ? "w-16 px-2" : "w-60 px-3"}`}
      aria-label="Lab sidebar"
    >
      <div className={`flex ${collapsed ? "flex-col items-center gap-2" : "items-start justify-between"}`}>
        <Link href="/lab" className={collapsed ? "text-[15px] font-bold tracking-tight" : "px-3"} title="Project Lab">
          {collapsed ? (
            "PL"
          ) : (
            <>
              <span className="block text-[17px] font-bold tracking-tight">Project Lab</span>
              <span className="block text-[13px] text-muted">VTCONS</span>
            </>
          )}
        </Link>
        <button
          type="button"
          onClick={() => toggle()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Svg d={collapsed ? ICON.expand : ICON.collapse} size={18} />
        </button>
      </div>

      <div className="mt-6 flex min-h-0 flex-1 flex-col">
        <SideNav compact={collapsed} />
        {onWorkspace &&
          (collapsed ? (
            <button
              type="button"
              onClick={() => toggle(false)}
              className="mx-auto mt-4 inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
              aria-label="Show notebook contents"
              title="Notebook contents"
            >
              <Svg d={ICON.contents} />
            </button>
          ) : (
            <div className="mt-5 flex min-h-0 flex-1 flex-col border-t border-line pt-4">
              <p className="mb-2 px-3 text-[12px] font-semibold uppercase tracking-wide text-muted">Notebook contents</p>
              <nav aria-label="Notebook contents" className="min-h-0 flex-1 overflow-y-auto">
                <NotebookContents />
              </nav>
            </div>
          ))}
      </div>

      <div className={`space-y-1 border-t border-line pt-3 ${collapsed ? "flex flex-col items-center" : ""}`}>
        {email && !collapsed && (
          <p className="truncate px-3 text-[13px] text-muted" title={email}>
            {email}
          </p>
        )}
        <div className={collapsed ? "flex flex-col items-center gap-1" : "flex items-center justify-between"}>
          <form action={signOut}>
            <button
              type="submit"
              className={`inline-flex min-h-10 items-center gap-2 rounded-lg text-[14px] text-muted hover:bg-sunken hover:text-ink ${collapsed ? "w-10 justify-center" : "px-3"}`}
              aria-label="Sign out"
              title="Sign out"
            >
              {collapsed ? <Svg d={ICON.signOut} size={18} /> : "Sign out"}
            </button>
          </form>
          <ThemeToggle />
        </div>
        <Link
          href={portfolioHref}
          className={`flex items-center text-[14px] text-muted hover:text-ink ${collapsed ? "h-10 w-10 justify-center rounded-lg hover:bg-sunken" : "px-3 py-2"}`}
          aria-label="Public portfolio"
          title="Public portfolio"
        >
          {collapsed ? <Svg d={ICON.portfolio} size={18} /> : "Public portfolio"}
        </Link>
      </div>
    </aside>
  );
}
