"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { queueCommand, setTheme } from "@/app/actions";
import {
  IconCode,
  IconCommands,
  IconMoon,
  IconOverview,
  IconPlus,
  IconProjects,
  IconReports,
  IconSun,
  IconX,
} from "./Icons";

/* ---------------- navigation ---------------- */

export type NavKey = "overview" | "reports" | "commands" | "projects" | "docs";
export type NavItem = { key: NavKey; href: string; label: string; badge?: number };

const ICONS: Record<NavKey, (p: { size?: number; className?: string }) => React.ReactNode> = {
  overview: IconOverview,
  reports: IconReports,
  commands: IconCommands,
  projects: IconProjects,
  docs: IconCode,
};

/** Works on lab.vtcons.com (served at /) and on /lab elsewhere. */
function section(path: string): NavKey | null {
  const p = path.replace(/^\/lab/, "") || "/";
  if (p === "/") return "overview";
  if (p.startsWith("/reports") || p.startsWith("/r/")) return "reports";
  if (p.startsWith("/inbox")) return "commands";
  if (p.startsWith("/projects") || p.startsWith("/p/")) return "projects";
  if (p.startsWith("/docs")) return "docs";
  return null;
}

export function SideNav({ items }: { items: NavItem[] }) {
  const current = section(usePathname());
  return (
    <nav aria-label="Lab" className="flex flex-col gap-0.5">
      {items.map((it) => {
        const Icon = ICONS[it.key];
        const on = current === it.key;
        return (
          <Link
            key={it.key}
            href={it.href}
            aria-current={on ? "page" : undefined}
            className={`flex min-h-[42px] items-center gap-3 rounded-[10px] px-3 text-[15px] font-medium transition-colors ${
              on ? "bg-raised text-ink" : "text-pencil hover:bg-raised/60 hover:text-ink"
            }`}
          >
            <Icon size={19} className={on ? "text-signal" : undefined} />
            <span className="flex-1">{it.label}</span>
            {it.badge ? (
              <span className="min-w-[22px] rounded-full bg-warn px-1.5 text-center text-[12px] font-bold leading-[20px] text-paper tnum">
                {it.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Bottom tab bar for phones and tablets. The compose button sits in the middle, under the thumb. */
export function TabBar({ items, composeLabel }: { items: NavItem[]; composeLabel?: string }) {
  const current = section(usePathname());
  const mid = composeLabel ? Math.ceil(items.length / 2) : -1;
  const cells: React.ReactNode[] = [];
  items.forEach((it, i) => {
    if (i === mid) cells.push(<ComposeFab key="fab" label={composeLabel!} />);
    const Icon = ICONS[it.key];
    const on = current === it.key;
    cells.push(
      <Link
        key={it.key}
        href={it.href}
        aria-current={on ? "page" : undefined}
        className={`relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[11.5px] font-medium ${
          on ? "text-ink" : "text-pencil"
        }`}
      >
        <span className="relative">
          <Icon size={22} className={on ? "text-signal" : undefined} />
          {it.badge ? (
            <span className="absolute -right-2.5 -top-1.5 min-w-[18px] rounded-full bg-warn px-1 text-center text-[11px] font-bold leading-[18px] text-paper tnum">
              {it.badge}
            </span>
          ) : null}
        </span>
        {it.label}
      </Link>,
    );
  });
  return (
    <nav
      aria-label="Lab"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-sheet/90 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-[640px] items-stretch px-2">{cells}</div>
    </nav>
  );
}

function ComposeFab({ label }: { label: string }) {
  return (
    <div className="flex flex-1 items-start justify-center">
      <button
        type="button"
        onClick={() => openComposer()}
        aria-label={label}
        className="-mt-5 grid h-14 w-14 place-items-center rounded-full bg-signal text-signal-ink shadow-[0_8px_24px_-6px_var(--signal)] active:scale-95"
      >
        <IconPlus size={26} />
      </button>
    </div>
  );
}

/* ---------------- theme ---------------- */

export function ThemeToggle({ theme, labels }: { theme: "dark" | "light"; labels: { dark: string; light: string } }) {
  const path = usePathname();
  const [, start] = useTransition();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.dataset.theme = next; // instant; the cookie follows
        start(() => setTheme(next, path));
      }}
      aria-label={next === "light" ? labels.light : labels.dark}
      title={next === "light" ? labels.light : labels.dark}
      className="btn btn-ghost !min-h-[40px] !px-2.5"
    >
      {theme === "dark" ? <IconSun size={19} /> : <IconMoon size={19} />}
    </button>
  );
}

/* ---------------- composer ---------------- */

type ComposeDetail = { project?: string; reportId?: string; agent?: string | null; context?: string };

export function openComposer(detail: ComposeDetail = {}) {
  window.dispatchEvent(new CustomEvent<ComposeDetail>("vt:compose", { detail }));
}

/** Any button that opens the composer, optionally pre-filled. Usable from server components. */
export function ComposeButton({
  children,
  className = "btn btn-primary",
  project,
  reportId,
  agent,
  context,
}: ComposeDetail & { children: React.ReactNode; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => openComposer({ project, reportId, agent, context })}>
      {children}
    </button>
  );
}

export type ComposerLabels = {
  title: string;
  hint: string;
  project: string;
  anyProject: string;
  agent: string;
  anyAgent: string;
  send: string;
  sending: string;
  cancel: string;
  sent: string;
  followUp: string;
};

function Submit({ labels }: { labels: ComposerLabels }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary min-w-[140px] flex-1 sm:flex-none" disabled={pending}>
      {pending ? labels.sending : labels.send}
    </button>
  );
}

export function Composer({ projects, agents, labels }: { projects: { slug: string; name: string }[]; agents: string[]; labels: ComposerLabels }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<ComposeDetail>({});
  const [n, setN] = useState(0); // remounts the form so fields reset each time
  const [toast, setToast] = useState(false);

  useEffect(() => {
    const onOpen = (e: Event) => {
      setDetail((e as CustomEvent<ComposeDetail>).detail ?? {});
      setN((x) => x + 1);
      ref.current?.showModal();
    };
    window.addEventListener("vt:compose", onOpen);
    return () => window.removeEventListener("vt:compose", onOpen);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(false), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  const close = () => ref.current?.close();

  return (
    <>
      <dialog
        ref={ref}
        className="composer"
        aria-labelledby="composer-title"
        onClick={(e) => {
          if (e.target === ref.current) close(); // tap outside closes
        }}
      >
        <form
          key={n}
          action={async (fd) => {
            await queueCommand(fd);
            close();
            setToast(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.requestSubmit();
          }}
          className="flex flex-col gap-4 p-5 sm:p-6"
          style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto -mt-2 mb-1 h-1 w-10 rounded-full bg-rule sm:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="composer-title" className="text-[19px] font-semibold">
                {detail.reportId ? labels.followUp : labels.title}
              </h2>
              {detail.context ? <p className="mt-0.5 line-clamp-1 text-[14px] text-pencil">{detail.context}</p> : null}
            </div>
            <button type="button" onClick={close} aria-label={labels.cancel} className="btn btn-ghost !min-h-[40px] !px-2.5">
              <IconX size={20} />
            </button>
          </div>
          {detail.reportId ? <input type="hidden" name="report_id" value={detail.reportId} /> : null}
          <textarea
            name="body"
            required
            rows={4}
            autoFocus
            aria-label={labels.title}
            placeholder={labels.hint}
            className="field resize-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-pencil">
              {labels.project}
              <select name="project" defaultValue={detail.project ?? ""} className="field">
                <option value="">{labels.anyProject}</option>
                {projects.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-pencil">
              {labels.agent}
              <input name="agent" list="vt-agents" defaultValue={detail.agent ?? ""} placeholder={labels.anyAgent} className="field" autoComplete="off" />
              <datalist id="vt-agents">
                {agents.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </label>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={close} className="btn btn-ghost">
              {labels.cancel}
            </button>
            <Submit labels={labels} />
          </div>
        </form>
      </dialog>
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(92px+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 lg:bottom-8">
        {toast ? (
          <p className="toast panel pointer-events-auto flex items-center gap-2.5 px-4 py-3 text-[15px] font-medium">
            <span className="live-dot" aria-hidden />
            {labels.sent}
          </p>
        ) : null}
      </div>
    </>
  );
}
