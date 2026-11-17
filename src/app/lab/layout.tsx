import Link from "next/link";
import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth";
import { getLang, t } from "@/lib/i18n";
import { getTheme } from "@/lib/theme";
import { listCommands, listProjects, listReports } from "@/lib/db";
import { LangToggle } from "@/components/LangToggle";
import { Composer, ComposeButton, SideNav, TabBar, ThemeToggle, type NavItem } from "@/components/LabChrome";
import { projectName } from "@/components/LabParts";
import { IconLogin, IconLogout, IconPlus } from "@/components/Icons";
import { logout } from "@/app/actions";

export const metadata: Metadata = {
  title: "VT Lab — William Doan's analysis log",
  description: "Analyses, charts and model results posted by William Doan's AI agents, as they happen.",
};

function Wordmark() {
  return (
    <Link href="/lab" className="flex items-center gap-2.5 text-[17px] font-bold tracking-tight">
      <span aria-hidden className="grid h-8 w-8 place-items-center rounded-[9px] bg-signal text-[13px] font-bold text-signal-ink">
        VT
      </span>
      VT Lab
    </Link>
  );
}

export default async function LabLayout({ children }: LayoutProps<"/lab">) {
  const [admin, lang, theme] = await Promise.all([isAdmin(), getLang(), getTheme()]);
  const d = t(lang);
  const [open, projects, recent] = admin
    ? await Promise.all([
        listCommands({ status: "open", limit: 200 }).catch(() => []),
        listProjects({ includePrivate: true }).catch(() => []),
        listReports({ includePrivate: true, limit: 100 }).catch(() => []),
      ])
    : [[], [], []];

  const items: NavItem[] = [
    { key: "overview", href: "/lab", label: d.overview },
    { key: "reports", href: "/lab/reports", label: d.reports },
    ...(admin ? [{ key: "commands" as const, href: "/lab/inbox", label: d.commandsNav, badge: open.length }] : []),
    { key: "projects", href: "/lab/projects", label: d.projects },
  ];
  const docs: NavItem = { key: "docs", href: "/lab/docs", label: d.docs };
  const themeLabels = { dark: d.toDark, light: d.toLight };

  const signInOut = admin ? (
    <form action={logout}>
      <button className="btn btn-ghost !min-h-[40px] !px-2.5" aria-label={d.logout} title={d.logout}>
        <IconLogout size={19} />
      </button>
    </form>
  ) : (
    <Link href="/lab/login" className="btn btn-ghost !min-h-[40px] !px-2.5" aria-label={d.signIn} title={d.signIn}>
      <IconLogin size={19} />
    </Link>
  );

  return (
    <div className="flex min-h-screen lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      <a href="#lab-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[8px] focus:bg-sheet focus:px-3 focus:py-2">
        {lang === "vi" ? "Chuyển tới nội dung" : "Skip to content"}
      </a>

      {/* Desktop and iPad landscape: sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-rule bg-sheet/50 px-4 py-5 lg:flex">
        <div className="px-1">
          <Wordmark />
        </div>
        {admin ? (
          <ComposeButton className="btn btn-primary w-full">
            <IconPlus size={18} />
            {d.newTask}
          </ComposeButton>
        ) : null}
        <SideNav items={[...items, docs]} />
        <div className="mt-auto flex flex-col gap-3 border-t border-rule pt-4">
          <div className="flex items-center justify-between gap-2 px-1">
            <LangToggle lang={lang} />
            <div className="flex items-center">
              <ThemeToggle theme={theme} labels={themeLabels} />
              {signInOut}
            </div>
          </div>
          <a href="https://william-doan.vtcons.com" className="px-1 text-[13px] text-pencil hover:text-ink">
            {d.aboutWilliam}
          </a>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phones and tablets: slim top bar */}
        <header className="sticky top-0 z-30 border-b border-rule bg-paper/85 backdrop-blur-md lg:hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="wrap flex h-14 items-center gap-2">
            <Wordmark />
            <div className="ml-auto flex items-center gap-1">
              <LangToggle lang={lang} />
              <ThemeToggle theme={theme} labels={themeLabels} />
              {signInOut}
            </div>
          </div>
        </header>

        <main id="lab-main" className="wrap pb-tabbar flex-1 pt-5 md:pt-8 lg:pt-10">
          {children}
        </main>
      </div>

      <TabBar items={admin ? items : [...items, docs]} composeLabel={admin ? d.newTask : undefined} />

      {admin ? (
        <Composer
          projects={projects.map((p) => ({ slug: p.slug, name: projectName(p, p.slug, lang) }))}
          agents={[...new Set(recent.map((r) => r.agent).filter((a): a is string => Boolean(a)))]}
          labels={{
            title: d.newTask,
            hint: d.composeHint,
            project: d.project,
            anyProject: d.anyProject,
            agent: d.agent,
            anyAgent: d.anyAgent,
            send: d.send,
            sending: d.sending,
            cancel: d.cancel,
            sent: d.sent,
            followUp: d.followUp,
          }}
        />
      ) : null}
    </div>
  );
}
