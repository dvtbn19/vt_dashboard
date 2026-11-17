import Link from "next/link";
import type { Block, Command, Project, Report } from "@/lib/db";
import { clock, dayLabel, pick, timeAgo, type Dict, type Lang } from "@/lib/i18n";
import { setCommandStatus } from "@/app/actions";
import { StatusPill } from "./Status";
import { ComposeButton } from "./LabChrome";
import { IconArrow, IconCheck, IconLock, IconReply, IconX } from "./Icons";

export const projectName = (p: Project | undefined, slug: string, lang: Lang) =>
  p ? pick(lang, p.title, p.title_vi).split(" — ")[0] : slug;

const plain = (s: string) => s.replace(/[*_#`>]/g, "");

/* ---------- agents ---------- */

function hue(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function AgentAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const h = hue(name);
  const initials = name
    .replace(/[-_]?bot$/i, "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className="grid flex-none place-items-center rounded-[9px] font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `hsl(${h} 70% 55% / 0.16)`,
        color: `hsl(${h} 70% 55%)`,
        boxShadow: `inset 0 0 0 1px hsl(${h} 70% 55% / 0.3)`,
      }}
    >
      {initials || "?"}
    </span>
  );
}

export type AgentState = { name: string; state: "running" | "failed" | "idle"; task: Report; seen: string };

/** What each agent is doing, from its latest report. */
export function agentStates(reports: Report[]): AgentState[] {
  const by = new Map<string, Report[]>();
  for (const r of reports) {
    if (!r.agent) continue;
    by.set(r.agent, [...(by.get(r.agent) ?? []), r]);
  }
  const out: AgentState[] = [];
  for (const [name, rs] of by) {
    const latest = rs.reduce((a, b) => (a.updated_at > b.updated_at ? a : b));
    const running = rs.find((r) => r.status === "running");
    const task = running ?? latest;
    out.push({ name, state: running ? "running" : latest.status === "failed" ? "failed" : "idle", task, seen: latest.updated_at });
  }
  const order = { running: 0, failed: 1, idle: 2 };
  return out.sort((a, b) => order[a.state] - order[b.state] || b.seen.localeCompare(a.seen));
}

export function AgentCard({ a, lang, d }: { a: AgentState; lang: Lang; d: Dict }) {
  const word = a.state === "running" ? (lang === "vi" ? "đang chạy" : "running") : a.state === "failed" ? (lang === "vi" ? "lỗi" : "failed") : d.idle;
  return (
    <Link href={`/lab/r/${a.task.id}`} className="panel flex min-w-[240px] flex-1 flex-col gap-3 p-4 sm:min-w-0">
      <div className="flex items-center gap-3">
        <AgentAvatar name={a.name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{a.name}</div>
          <div className="text-[13px] text-pencil">
            {d.lastSeen} {timeAgo(a.seen, lang)}
          </div>
        </div>
        <span className="status" data-s={a.state === "idle" ? "done" : a.state}>
          {word}
        </span>
      </div>
      <p className="line-clamp-2 text-[14px] leading-snug text-pencil">
        <span className="text-ink">{a.task.title}</span>
      </p>
    </Link>
  );
}

/* ---------- stat tiles ---------- */

export function StatTile({
  label,
  value,
  href,
  tone,
  sub,
}: {
  label: string;
  value: number;
  href: string;
  tone: "live" | "warn" | "ink" | "red";
  sub?: string;
}) {
  const color = { live: "text-live", warn: "text-warn", ink: "text-ink", red: "text-redpen" }[tone];
  const quiet = value === 0;
  return (
    <Link href={href} className="panel group flex flex-col justify-between gap-3 p-4 sm:p-5">
      <span className="flex items-center gap-2 text-[14px] font-medium text-pencil">
        {tone === "live" && !quiet ? <span className="live-dot" aria-hidden /> : null}
        {label}
      </span>
      <span className="flex items-end justify-between gap-2">
        <span className={`text-[34px] font-bold leading-none tracking-[-0.02em] tnum sm:text-[40px] ${quiet ? "text-pencil/60" : color}`}>{value}</span>
        <IconArrow size={18} className="mb-1 text-pencil opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
      <span className="-mt-1 truncate text-[13px] text-pencil">{sub ?? "\u00a0"}</span>
    </Link>
  );
}

/* ---------- reports ---------- */

export function Progress({ value, className = "" }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={`flex items-center gap-2.5 ${className}`} role="img" aria-label={`${v}%`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
        <div className="h-full rounded-full bg-signal" style={{ width: `${v}%` }} />
      </div>
      <span className="w-9 text-right text-[13px] font-medium text-pencil tnum">{v}%</span>
    </div>
  );
}

function fmtNum(v: string | number) {
  return typeof v === "number" ? (Number.isInteger(v) ? v.toLocaleString("en-US") : v.toLocaleString("en-US", { maximumFractionDigits: 4 })) : v;
}

/** A tiny static drawing of the report's first chart, or its first two numbers. */
function Preview({ blocks }: { blocks: Block[] }) {
  const metrics = blocks.find((b) => b.type === "metrics");
  const plot = blocks.find((b) => b.type === "plotly");
  if (plot) {
    const svg = <MiniChart data={plot.figure.data} />;
    if (svg) return svg;
  }
  if (metrics && metrics.items.length) {
    return (
      <dl className="grid grid-cols-2 gap-3">
        {metrics.items.slice(0, 2).map((m, i) => (
          <div key={i} className="min-w-0 rounded-[10px] bg-raised px-3 py-2.5">
            <dt className="truncate text-[12.5px] text-pencil">{m.label}</dt>
            <dd className="mt-0.5 truncate text-[20px] font-semibold leading-tight tnum">{fmtNum(m.value)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return null;
}

type Trace = { type?: string; y?: unknown; z?: unknown; mode?: string };

function MiniChart({ data }: { data: unknown[] }) {
  const traces = (data as Trace[]).filter(Boolean);
  const W = 300;
  const H = 64;
  const first = traces[0];
  if (!first) return null;

  if (first.type === "heatmap" && Array.isArray(first.z)) {
    const z = first.z as number[][];
    const flat = z.flat().filter((v) => typeof v === "number");
    if (!flat.length) return null;
    const lo = Math.min(...flat);
    const hi = Math.max(...flat);
    const rows = z.length;
    const cols = Math.max(...z.map((r) => r.length));
    const cw = Math.min(W / cols, 28);
    const ch = H / rows;
    return (
      <svg viewBox={`0 0 ${cw * cols} ${H}`} className="h-16 w-auto max-w-full rounded-[8px]" aria-hidden>
        {z.map((row, i) =>
          row.map((v, j) => (
            <rect key={`${i}-${j}`} x={j * cw} y={i * ch} width={cw - 2} height={ch - 2} rx={2} fill="var(--chart-1)" opacity={0.15 + 0.85 * ((v - lo) / (hi - lo || 1))} />
          )),
        )}
      </svg>
    );
  }

  const series = traces
    .map((t) => (Array.isArray(t.y) ? (t.y as unknown[]).filter((v): v is number => typeof v === "number") : []))
    .filter((ys) => ys.length >= 2)
    .slice(0, 3);
  if (!series.length) return null;
  const all = series.flat();
  // Bars need a zero baseline; lines read better zoomed to their own range
  const lo = first.type === "bar" ? Math.min(0, ...all) : Math.min(...all);
  const hi = Math.max(...all);
  const y = (v: number) => H - 4 - ((v - lo) / (hi - lo || 1)) * (H - 8);

  if (first.type === "bar") {
    const ys = series[0];
    const bw = W / ys.length;
    const max = ys.indexOf(Math.max(...ys));
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-16 w-full" aria-hidden>
        {ys.map((v, i) => (
          <rect key={i} x={i * bw + bw * 0.12} width={bw * 0.76} y={y(v)} height={H - y(v)} rx={2} fill={i === max ? "var(--chart-1)" : "color-mix(in srgb, var(--chart-1) 35%, transparent)"} />
        ))}
      </svg>
    );
  }

  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-16 w-full" aria-hidden>
      {series.map((ys, k) => {
        const pts = ys.map((v, i) => `${(i / (ys.length - 1)) * W},${y(v)}`).join(" ");
        return <polyline key={k} points={pts} fill="none" stroke={colors[k]} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />;
      })}
    </svg>
  );
}

export function ReportCard({
  r,
  lang,
  d,
  admin,
  project,
  cmd,
}: {
  r: Report;
  lang: Lang;
  d: Dict;
  admin: boolean;
  project?: string | null;
  cmd?: Command;
}) {
  const vi = lang === "vi";
  return (
    <article className="panel relative flex flex-col gap-3 p-4 transition-colors hover:border-[color-mix(in_srgb,var(--signal)_55%,var(--rule))] sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-pencil">
        <StatusPill status={r.status} lang={lang} />
        {project ? <span className="font-medium">{project}</span> : null}
        {r.kind ? <span className="rounded-full bg-raised px-2 py-0.5 text-[12px] font-medium">{r.kind}</span> : null}
        {admin && !r.is_public ? (
          <span className="inline-flex items-center gap-1">
            <IconLock size={13} />
            {d.private}
          </span>
        ) : null}
        <time dateTime={r.created_at} className="ml-auto tnum">
          {dayLabel(r.created_at, lang)}, {clock(r.created_at)}
        </time>
      </div>
      <h3 className="text-[17px] font-semibold leading-snug">
        <Link href={`/lab/r/${r.id}`} className="after:absolute after:inset-0 after:rounded-[14px]">
          {r.title}
        </Link>
      </h3>
      {r.summary ? <p className="line-clamp-2 text-[15px] leading-relaxed text-pencil">{plain(r.summary)}</p> : null}
      <Preview blocks={r.blocks} />
      {(r.agent || cmd) && (
        <div className="mt-auto flex items-start gap-2.5 border-t border-rule pt-3 text-[13.5px]">
          {r.agent ? <AgentAvatar name={r.agent} size={22} /> : null}
          <div className="min-w-0 flex-1">
            {r.agent ? <span className="font-medium">{r.agent}</span> : null}
            {cmd ? (
              <p className="line-clamp-1 text-pencil">
                {vi ? "theo lệnh: " : "asked: "}
                {cmd.body}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </article>
  );
}

export function ReportGrid(props: {
  reports: Report[];
  lang: Lang;
  d: Dict;
  admin: boolean;
  projects?: Map<string, Project>;
  commands?: Map<string, Command>;
  showProject?: boolean;
}) {
  const { reports, lang, d, admin, projects, commands, showProject = true } = props;
  if (!reports.length) return <Empty d={d} lang={lang} />;
  return (
    <div className="grid gap-3 sm:gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {reports.map((r) => (
        <ReportCard
          key={r.id}
          r={r}
          lang={lang}
          d={d}
          admin={admin}
          project={showProject ? projectName(projects?.get(r.project_slug), r.project_slug, lang) : null}
          cmd={r.parent_command_id ? commands?.get(r.parent_command_id) : undefined}
        />
      ))}
    </div>
  );
}

export function Empty({ d, lang, text }: { d: Dict; lang: Lang; text?: string }) {
  return (
    <div className="panel flex flex-col items-start gap-2 border-dashed p-6">
      <p className="max-w-[48ch] text-pencil">{text ?? d.noReports}</p>
      <Link href="/lab/docs" className="link text-[15px]">
        {lang === "vi" ? "Hướng dẫn cho agent đăng báo cáo" : "How agents post a report"}
      </Link>
    </div>
  );
}

/** Compact one-line rows for the overview feed. */
export function FeedList({ reports, lang, projects }: { reports: Report[]; lang: Lang; projects: Map<string, Project> }) {
  return (
    <ol className="panel divide-y divide-rule overflow-hidden">
      {reports.map((r) => (
        <li key={r.id}>
          <Link href={`/lab/r/${r.id}`} className="flex min-h-[60px] items-center gap-3 px-4 py-3 hover:bg-raised/60">
            {r.agent ? <AgentAvatar name={r.agent} size={28} /> : <span className="w-7" />}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-medium">{r.title}</div>
              <div className="flex items-center gap-2 text-[13px] text-pencil">
                <StatusPill status={r.status} lang={lang} />
                <span className="truncate">{projectName(projects.get(r.project_slug), r.project_slug, lang)}</span>
              </div>
            </div>
            <time dateTime={r.created_at} className="flex-none text-[13px] text-pencil tnum">
              {timeAgo(r.created_at, lang)}
            </time>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/* ---------- commands ---------- */

export function CommandCard({ c, lang, d, admin, compact = false }: { c: Command; lang: Lang; d: Dict; admin: boolean; compact?: boolean }) {
  const vi = lang === "vi";
  const open = c.status === "pending" || c.status === "claimed";
  return (
    <li className={`panel flex flex-col gap-2.5 ${compact ? "p-3.5" : "p-4"}`}>
      <p className={`text-[15.5px] leading-relaxed ${c.status === "cancelled" ? "text-pencil line-through" : ""}`}>{c.body}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-pencil">
        <StatusPill status={c.status} lang={lang} />
        <span className="inline-flex items-center gap-1.5">
          {c.agent ? <AgentAvatar name={c.agent} size={18} /> : null}
          {c.agent ?? d.anyAgent.toLowerCase()}
        </span>
        {c.project_slug ? <span>{c.project_slug}</span> : null}
        <span className="tnum">{timeAgo(c.created_at, lang)}</span>
      </div>
      {c.response ? <p className="rounded-[10px] bg-raised px-3 py-2 text-[14px]">{c.response}</p> : null}
      {c.result_report_id || (admin && open) ? (
        <div className="flex flex-wrap gap-2 pt-0.5">
          {c.result_report_id ? (
            <Link href={`/lab/r/${c.result_report_id}`} className="btn btn-sm">
              {vi ? "Xem kết quả" : "See the result"}
              <IconArrow size={16} />
            </Link>
          ) : null}
          {admin && open ? (
            <>
              <form action={setCommandStatus.bind(null, c.id, "done")}>
                <button className="btn btn-sm">
                  <IconCheck size={16} />
                  {d.markDone}
                </button>
              </form>
              <form action={setCommandStatus.bind(null, c.id, "cancelled")}>
                <button className="btn btn-sm btn-ghost btn-danger">
                  <IconX size={16} />
                  {d.cancel}
                </button>
              </form>
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function CommandList({ commands, lang, d, admin, compact }: { commands: Command[]; lang: Lang; d: Dict; admin: boolean; compact?: boolean }) {
  if (!commands.length) return <p className="panel border-dashed p-5 text-[15px] text-pencil">{d.noCommands}</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {commands.map((c) => (
        <CommandCard key={c.id} c={c} lang={lang} d={d} admin={admin} compact={compact} />
      ))}
    </ul>
  );
}

/* ---------- projects ---------- */

export function ProjectCard({ p, lang, d, admin, counts }: { p: Project; lang: Lang; d: Dict; admin: boolean; counts?: { reports: number; running: number } }) {
  const vi = lang === "vi";
  return (
    <Link href={`/lab/p/${p.slug}`} className="panel flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[17px] font-semibold leading-snug">{projectName(p, p.slug, lang)}</h3>
        <StatusPill status={p.status} lang={lang} />
      </div>
      <p className="line-clamp-2 text-[14.5px] leading-relaxed text-pencil">{pick(lang, p.summary, p.summary_vi)}</p>
      <Progress value={p.progress} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-pencil">
        {counts ? (
          <span className="tnum">
            {counts.reports} {vi ? "báo cáo" : counts.reports === 1 ? "report" : "reports"}
          </span>
        ) : null}
        {counts?.running ? (
          <span className="inline-flex items-center gap-1.5 text-live">
            <span className="live-dot" aria-hidden />
            {counts.running} {vi ? "đang chạy" : "running"}
          </span>
        ) : null}
        {admin && !p.is_public ? (
          <span className="inline-flex items-center gap-1">
            <IconLock size={13} />
            {d.private}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

/* ---------- project thread: your commands and the agents' reports, newest first ---------- */

export function Thread({ reports, commands, lang, d, admin }: { reports: Report[]; commands: Command[]; lang: Lang; d: Dict; admin: boolean }) {
  const vi = lang === "vi";
  const cmdById = new Map(commands.map((c) => [c.id, c]));
  const items = [
    ...reports.map((r) => ({ kind: "r" as const, at: r.created_at, r })),
    ...commands.map((c) => ({ kind: "c" as const, at: c.created_at, c })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  if (!items.length) return <Empty d={d} lang={lang} />;
  return (
    <ol className="flex flex-col gap-3">
      {items.map((it) =>
        it.kind === "c" ? (
          <li key={`c-${it.c.id}`} className="flex justify-end">
            <div className="max-w-[88%] rounded-[16px] rounded-br-[4px] bg-signal/12 px-4 py-3 ring-1 ring-signal/25 sm:max-w-[75%]">
              <p className="text-[15px] leading-relaxed">{it.c.body}</p>
              <div className="mt-1.5 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[12.5px] text-pencil">
                <StatusPill status={it.c.status} lang={lang} />
                <span>{it.c.agent ?? d.anyAgent.toLowerCase()}</span>
                <span className="tnum">{timeAgo(it.c.created_at, lang)}</span>
                {admin && (it.c.status === "pending" || it.c.status === "claimed") ? (
                  <form action={setCommandStatus.bind(null, it.c.id, "cancelled")}>
                    <button className="min-h-[32px] px-1 font-medium hover:text-redpen">{d.cancel}</button>
                  </form>
                ) : null}
              </div>
            </div>
          </li>
        ) : (
          <li key={`r-${it.r.id}`} className="flex flex-col gap-2 sm:max-w-[92%]">
            <ReportCard r={it.r} lang={lang} d={d} admin={admin} cmd={it.r.parent_command_id ? cmdById.get(it.r.parent_command_id) : undefined} />
            {admin ? (
              <ComposeButton
                className="btn btn-sm btn-ghost self-start"
                project={it.r.project_slug}
                reportId={it.r.id}
                agent={it.r.agent}
                context={it.r.title}
              >
                <IconReply size={16} />
                {vi ? "Giao việc tiếp" : "Follow up"}
              </ComposeButton>
            ) : null}
          </li>
        ),
      )}
    </ol>
  );
}
