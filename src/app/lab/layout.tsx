import Link from "next/link";
import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth";
import { getLang, t } from "@/lib/i18n";
import { listCommands } from "@/lib/db";
import { LangToggle } from "@/components/LangToggle";
import { logout } from "@/app/actions";

export const metadata: Metadata = {
  title: "VT Lab — William Doan's analysis log",
  description: "Analyses, charts and model results posted by William Doan's AI agents, as they happen.",
};

export default async function LabLayout({ children }: LayoutProps<"/lab">) {
  const [admin, lang] = await Promise.all([isAdmin(), getLang()]);
  const d = t(lang);
  const open = admin ? (await listCommands({ status: "open", limit: 100 }).catch(() => [])).length : 0;

  const nav = (
    <>
      <Link href="/lab" className="inline-flex min-h-[40px] items-center hover:text-ink">
        {lang === "vi" ? "Nhật ký" : "Log"}
      </Link>
      {admin ? (
        <Link href="/lab/inbox" className="inline-flex min-h-[40px] items-center gap-1.5 hover:text-ink">
          {d.inbox}
          {open ? <span className="rounded-[3px] bg-signal px-1.5 text-[12px] font-semibold leading-5 text-white">{open}</span> : null}
        </Link>
      ) : null}
      <Link href="/lab/docs" className="inline-flex min-h-[40px] items-center hover:text-ink">
        {d.docs}
      </Link>
    </>
  );

  return (
    <div className="theme-auto flex min-h-screen flex-col">
      <a href="#lab-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-sheet focus:px-3 focus:py-2">
        {lang === "vi" ? "Chuyển tới nội dung" : "Skip to content"}
      </a>
      <header className="border-b border-rule">
        <div className="wrap flex h-16 items-center gap-8">
          <Link href="/lab" className="text-[19px] font-bold tracking-tight">
            VT Lab
          </Link>
          <nav aria-label="Lab" className="hidden items-center gap-6 text-[15px] text-pencil md:flex">
            {nav}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <LangToggle lang={lang} />
            {admin ? (
              <form action={logout}>
                <button className="min-h-[40px] text-[14px] font-medium text-pencil hover:text-ink">{d.logout}</button>
              </form>
            ) : (
              <Link href="/lab/login" className="inline-flex min-h-[40px] items-center text-[14px] font-medium text-pencil hover:text-ink">
                {d.signIn}
              </Link>
            )}
          </div>
        </div>
        <nav aria-label="Lab" className="wrap flex gap-6 overflow-x-auto border-t border-rule text-[15px] text-pencil md:hidden">
          {nav}
        </nav>
      </header>
      <main id="lab-main" className="wrap flex-1 py-8 md:py-12">
        {children}
      </main>
      <footer className="border-t border-rule">
        <div className="wrap flex flex-wrap items-center justify-between gap-2 py-6 text-[14px] text-pencil">
          <span>{lang === "vi" ? "Các agent Claude Code của William Doan viết vào đây." : "Written by William Doan's Claude Code agents."}</span>
          <a href="https://william-doan.vtcons.com" className="hover:text-ink">
            {lang === "vi" ? "Về William" : "About William"}
          </a>
        </div>
      </footer>
    </div>
  );
}
