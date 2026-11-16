import Link from "next/link";
import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth";
import { getLang, t } from "@/lib/i18n";
import { LangToggle } from "@/components/LangToggle";
import { logout } from "@/app/actions";

export const metadata: Metadata = {
  title: "VT Lab — live data & AI projects",
  description: "Live project hub: analyses, charts and model results posted by AI agents.",
};

export default async function LabLayout({ children }: LayoutProps<"/lab">) {
  const [admin, lang] = await Promise.all([isAdmin(), getLang()]);
  const d = t(lang);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/lab" className="flex items-center gap-2 font-mono text-sm font-semibold tracking-tight">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-lime text-[11px] font-bold text-ink">VT</span>
            <span>
              LAB<span className="text-lime">_</span>
            </span>
          </Link>
          <nav className="ml-2 hidden items-center gap-1 text-sm text-muted sm:flex">
            <Link href="/lab" className="rounded-md px-2.5 py-1.5 hover:bg-white/5 hover:text-fg">
              {d.projects}
            </Link>
            {admin ? (
              <Link href="/lab/inbox" className="rounded-md px-2.5 py-1.5 hover:bg-white/5 hover:text-fg">
                {d.inbox}
              </Link>
            ) : null}
            <Link href="/lab/docs" className="rounded-md px-2.5 py-1.5 hover:bg-white/5 hover:text-fg">
              {d.docs}
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LangToggle lang={lang} />
            {admin ? (
              <form action={logout}>
                <button className="rounded-full border border-line-2 px-3 py-1 font-mono text-[11px] text-muted hover:text-fg">
                  {d.logout}
                </button>
              </form>
            ) : (
              <Link href="/lab/login" className="rounded-full border border-line-2 px-3 py-1 font-mono text-[11px] text-muted hover:text-fg">
                {d.signIn}
              </Link>
            )}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-line px-3 py-1.5 text-sm text-muted sm:hidden">
          <Link href="/lab" className="rounded-md px-2.5 py-1 hover:text-fg">
            {d.projects}
          </Link>
          {admin ? (
            <Link href="/lab/inbox" className="rounded-md px-2.5 py-1 hover:text-fg">
              {d.inbox}
            </Link>
          ) : null}
          <Link href="/lab/docs" className="rounded-md px-2.5 py-1 hover:text-fg">
            {d.docs}
          </Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 font-mono text-[11px] text-dim">
          <span>VT LAB · built by William Doan with Claude Code agents</span>
          <a href="https://william-doan.vtcons.com" className="hover:text-fg">
            {d.portfolio} ↗
          </a>
        </div>
      </footer>
    </div>
  );
}
