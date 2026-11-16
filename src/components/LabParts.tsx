import Link from "next/link";
import type { Command, Project, Report } from "@/lib/db";
import { clock, groupByDay, pick, timeAgo, type Dict, type Lang } from "@/lib/i18n";
import { queueCommand, setCommandStatus } from "@/app/actions";
import { StatusPill } from "./Status";

const projectName = (p: Project | undefined, slug: string, lang: Lang) =>
  p ? pick(lang, p.title, p.title_vi).split(" — ")[0] : slug;

/* ---------- Project rows (compact, for the rail) ---------- */

export function ProjectList({ projects, lang, d, admin }: { projects: Project[]; lang: Lang; d: Dict; admin: boolean }) {
  if (!projects.length) {
    return <p className="py-4 text-[15px] text-pencil">{lang === "vi" ? "Chưa có dự án công khai." : "No public projects yet."}</p>;
  }
  return (
    <ul className="border-t border-ink">
      {projects.map((p) => (
        <li key={p.slug} className="border-b border-rule">
          <Link href={`/lab/p/${p.slug}`} className="group block py-4">
            <div className="flex items-start justify-between gap-3">
              <span className="font-semibold leading-snug group-hover:text-signal">{projectName(p, p.slug, lang)}</span>
              <StatusPill status={p.status} lang={lang} />
            </div>
            <p className="mt-1 line-clamp-2 text-[14px] text-pencil">{pick(lang, p.summary, p.summary_vi)}</p>
            <div className="mt-2.5 flex items-center gap-3">
              <Progress value={p.progress} />
              {admin && !p.is_public ? <span className="text-[13px] text-pencil">{d.private}</span> : null}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Progress({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-1 items-center gap-2.5" role="img" aria-label={`${v}%`}>
      <div className="h-[3px] flex-1 bg-rule">
        <div className="h-full bg-ink" style={{ width: `${v}%` }} />
      </div>
      <span className="w-9 text-right text-[13px] tabular-nums text-pencil">{v}%</span>
    </div>
  );
}

/* ---------- The log ---------- */

export function ReportLog({
  reports,
  lang,
  d,
  admin,
  projects,
  commands,
  showProject = true,
}: {
  reports: Report[];
  lang: Lang;
  d: Dict;
  admin: boolean;
  projects?: Map<string, Project>;
  commands?: Map<string, Command>;
  showProject?: boolean;
}) {
  if (!reports.length) {
    return (
      <div className="border-t border-ink py-10">
        <p className="max-w-[48ch] text-pencil">{d.noReports}</p>
        <p className="mt-2 text-[15px]">
          <Link href="/lab/docs" className="link">
            {lang === "vi" ? "Hướng dẫn cho agent đăng báo cáo" : "How agents post a report"}
          </Link>
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      {groupByDay(reports, lang).map((g) => (
        <section key={g.label}>
          <h3 className="border-b border-ink pb-2 text-[15px] font-semibold">{g.label}</h3>
          <ol>
            {g.items.map((r) => (
              <LogEntry
                key={r.id}
                r={r}
                lang={lang}
                d={d}
                admin={admin}
                project={showProject ? projectName(projects?.get(r.project_slug), r.project_slug, lang) : null}
                cmd={r.parent_command_id ? commands?.get(r.parent_command_id) : undefined}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function LogEntry({
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
  project: string | null;
  cmd?: Command;
}) {
  const vi = lang === "vi";
  return (
    <li className="grid grid-cols-[52px_1fr] gap-3 border-b border-rule py-4 sm:grid-cols-[64px_1fr] sm:gap-5">
      <time dateTime={r.created_at} className="pt-0.5 text-[14px] tabular-nums text-pencil">
        {clock(r.created_at)}
      </time>
      <div className="min-w-0">
        <Link href={`/lab/r/${r.id}`} className="text-[17px] font-semibold leading-snug hover:text-signal">
          {r.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-pencil">
          <StatusPill status={r.status} lang={lang} />
          {r.agent ? <span className="text-signal">{r.agent}</span> : null}
          {project ? (
            <span>
              {vi ? "trong" : "in"} {project}
            </span>
          ) : null}
          {r.kind ? <span>{r.kind}</span> : null}
          {admin && !r.is_public ? <span>{d.private}</span> : null}
        </div>
        {r.summary ? <p className="mt-1.5 line-clamp-2 max-w-[68ch] text-[15px] text-pencil">{r.summary.replace(/[*_#`>]/g, "")}</p> : null}
        {cmd ? (
          <p className="note mt-2.5 max-w-[60ch] text-[15px]">
            {vi ? "Bạn đã giao: " : "You asked: "}
            {cmd.body}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/* ---------- Commands ---------- */

export function CommandList({ commands, lang, d, admin }: { commands: Command[]; lang: Lang; d: Dict; admin: boolean }) {
  const vi = lang === "vi";
  if (!commands.length) return <p className="py-2 text-[15px] text-pencil">{d.noCommands}</p>;
  return (
    <ul className="flex flex-col">
      {commands.map((c) => (
        <li key={c.id} className="border-b border-rule py-3.5 last:border-b-0">
          <p className={`note text-[16px] ${c.status === "cancelled" ? "note-red line-through decoration-1" : ""}`}>{c.body}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-[14px] text-[13px] text-pencil">
            <StatusPill status={c.status} lang={lang} />
            <span>{c.agent ? c.agent : vi ? "agent bất kỳ" : "any agent"}</span>
            {c.project_slug ? <span>{c.project_slug}</span> : null}
            <span>{timeAgo(c.created_at, lang)}</span>
          </div>
          {c.response ? <p className="mt-2 pl-[14px] text-[15px]">{c.response}</p> : null}
          <div className="mt-1 flex flex-wrap items-center gap-1 pl-[6px] text-[14px]">
            {c.result_report_id ? (
              <Link href={`/lab/r/${c.result_report_id}`} className="link inline-flex min-h-[36px] items-center px-2">
                {vi ? "Xem kết quả" : "See the result"}
              </Link>
            ) : null}
            {admin && (c.status === "pending" || c.status === "claimed") ? (
              <>
                <form action={setCommandStatus.bind(null, c.id, "done")}>
                  <button className="min-h-[36px] px-2 text-pencil hover:text-ink">{d.markDone}</button>
                </form>
                <form action={setCommandStatus.bind(null, c.id, "cancelled")}>
                  <button className="min-h-[36px] px-2 text-pencil hover:text-redpen">{d.cancel}</button>
                </form>
              </>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CommandForm({
  d,
  reportId,
  project,
  agent,
  projects,
  id = "cmd",
}: {
  d: Dict;
  reportId?: string;
  project?: string;
  agent?: string | null;
  projects?: Project[];
  id?: string;
}) {
  return (
    <form action={queueCommand} className="flex flex-col gap-2.5">
      {reportId ? <input type="hidden" name="report_id" value={reportId} /> : null}
      {project ? <input type="hidden" name="project" value={project} /> : null}
      <label htmlFor={`${id}-body`} className="text-[15px] font-semibold">
        {d.nextStep}
      </label>
      <textarea id={`${id}-body`} name="body" required rows={3} placeholder={d.nextStepHint} className="field resize-y" />
      <div className="flex flex-wrap gap-2">
        {projects ? (
          <select name="project" defaultValue="" aria-label="Project" className="field !w-auto min-w-0 flex-1 basis-40">
            <option value="">{d.allProjects}</option>
            {projects.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.slug}
              </option>
            ))}
          </select>
        ) : null}
        <input name="agent" defaultValue={agent ?? ""} placeholder={d.agentOptional} aria-label={d.agentOptional} className="field min-w-0 flex-1 basis-44" />
        <button className="btn btn-primary flex-none">{d.send}</button>
      </div>
    </form>
  );
}
