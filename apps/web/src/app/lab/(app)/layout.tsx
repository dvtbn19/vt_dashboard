import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "../actions";
import { cookies } from "next/headers";
import { BottomNav } from "@/components/LabNav";
import { LabSidebar } from "@/components/LabSidebar";
import { MainFrame } from "@/components/MainFrame";
import { ThemeToggle } from "@/components/ThemeToggle";
import { api } from "@/lib/api";
import { portfolioHref } from "@/lib/config";
import { SIDEBAR_COOKIE } from "@/lib/sidebar";

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
  const sidebarCollapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";
  let me: Me = { email: null };
  try {
    me = await api<Me>("/v1/me");
  } catch (err) {
    // Redirects (401) propagate; an API outage is shown by the page's own error boundary.
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
  }
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[auto_1fr]">
      <LabSidebar email={me.email} portfolioHref={portfolioHref()} initialCollapsed={sidebarCollapsed} />

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
        <MainFrame>{children}</MainFrame>
      </main>
      <BottomNav />
    </div>
  );
}
