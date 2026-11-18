import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "../actions";
import { BottomNav, SideNav } from "@/components/LabNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { api } from "@/lib/api";
import { portfolioHref } from "@/lib/config";

export const metadata: Metadata = { title: { default: "Lab", template: "%s · Lab" }, robots: { index: false } };

type Me = { email: string | null };

function SignOut() {
  return (
    <form action={signOut}>
      <button type="submit" className="min-h-10 rounded-lg px-3 text-[14px] text-muted hover:bg-sunken hover:text-ink">
        Sign out
      </button>
    </form>
  );
}

export default async function LabLayout({ children }: { children: React.ReactNode }) {
  let me: Me = { email: null };
  try {
    me = await api<Me>("/v1/me");
  } catch (err) {
    // Redirects (401) propagate; an API outage is shown by the page's own error boundary.
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
  }
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
        <Link href="/lab" className="px-3 text-[17px] font-bold tracking-tight">
          Project Lab
        </Link>
        <p className="px-3 text-[13px] text-muted">VTCONS</p>
        <div className="mt-8 flex-1">
          <SideNav />
        </div>
        <div className="space-y-1 border-t border-line pt-3">
          {me.email && <p className="truncate px-3 text-[13px] text-muted" title={me.email}>{me.email}</p>}
          <div className="flex items-center justify-between">
            <SignOut />
            <ThemeToggle />
          </div>
          <Link href={portfolioHref()} className="block px-3 py-2 text-[14px] text-muted hover:text-ink">
            Public portfolio
          </Link>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
        <Link href="/lab" className="font-bold tracking-tight">
          Project Lab
        </Link>
        <div className="flex items-center">
          <ThemeToggle />
          <SignOut />
        </div>
      </header>

      <main id="main" className="min-w-0 pb-24 lg:pb-12">
        <div className="mx-auto w-full max-w-[1080px] px-4 pt-6 md:px-8 md:pt-10">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
