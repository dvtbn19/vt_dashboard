import Link from "next/link";
import type { Command, Project, Report } from "@/lib/db";
import { pick, timeAgo, type Dict, type Lang } from "@/lib/i18n";
import { queueCommand, setCommandStatus } from "@/app/actions";
import { StatusPill, VisibilityPill } from "./Status";

export function ProjectCard({ p, lang, d, admin }: { p: Project; lang: Lang; d: Dict; admin: boolean }) {
  return (
    <Link
      href={`/lab/p/${p.slug}`}
      className="card group relative flex flex-col gap-4 overflow-hidden p-5 transition hover:-translate-y-0.5 hover:border-line-2"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition group-hover:opacity-40"
        style={{ background: "var(--lime)" }}
      />
      <div className="flex items-center gap-2">
        <StatusPill status={p.status} />
        {admin ? <VisibilityPill isPublic={p.is_public} labels={d} /> : null}
        <span className="ml-auto font-mono text-[11px] text-dim">{timeAgo(p.updated_at, lang)}</span>
      </div>
      <div>
        <h3 className="text-lg font-semibold leading-snug">{pick(lang, p.title, p.title_vi)}</h3>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{pick(lang, p.summary, p.summary_vi)}</p>
      </div>
      <div className="mt-auto">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {p.tags.slice(0, 5).map((tag) => (
            <span key={tag} className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted">
              {tag}
            </span>
          ))}
        </div>
        <Progress value={p.progress} />
      </div>
    </Link>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-lime" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-muted">{value}%</span>
    </div>
  );
}

export function ReportRow({ r, lang, projects, admin, d }: { r: Report; lang: Lang; projects?: Map<string, Project>; admin: boolean; d: Dict }) {
  const p = projects?.get(r.project_slug);
  return (
    <Link href={`/lab/r/${r.id}`} className="group flex gap-4 border-b border-line py-4 last:border-0">
      <div className="flex flex-col items-center pt-1">
        <span
          className={`dot ${r.status === "running" ? "dot-pulse" : ""}`}
          style={{
            background: r.status === "failed" ? "var(--rose)" : r.status === "running" ? "var(--amber)" : "var(--lime)",
            color: r.status === "running" ? "var(--amber)" : undefined,
          }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-dim">
          {r.agent ? <span className="text-violet">@{r.agent}</span> : null}
          {p ? <span>→ {pick(lang, p.title, p.title_vi).split(" — ")[0]}</span> : <span>→ {r.project_slug}</span>}
          {r.kind ? <span className="rounded border border-line px-1">{r.kind}</span> : null}
          {admin && !r.is_public ? <span className="rounded bg-white/5 px-1">{d.private}</span> : null}
          <span className="ml-auto">{timeAgo(r.created_at, lang)}</span>
        </div>
        <div className="mt-1 font-medium leading-snug group-hover:text-lime">{r.title}</div>
        {r.summary ? <p className="mt-1 line-clamp-2 text-sm text-muted">{r.summary}</p> : null}
      </div>
    </Link>
  );
}

export function CommandList({ commands, lang, d, admin }: { commands: Command[]; lang: Lang; d: Dict; admin: boolean }) {
  if (!commands.length) return <p className="py-3 text-sm text-dim">{d.noCommands}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {commands.map((c) => (
        <li key={c.id} className="rounded-xl border border-line bg-ink-2 p-3">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-dim">
            <StatusPill status={c.status} />
            {c.agent ? <span className="text-violet">@{c.agent}</span> : <span>@any</span>}
            {c.project_slug ? <span>→ {c.project_slug}</span> : null}
            <span className="ml-auto">{timeAgo(c.created_at, lang)}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{c.body}</p>
          {c.response ? <p className="mt-2 border-l-2 border-violet pl-3 text-sm text-muted">{c.response}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            {c.result_report_id ? (
              <Link href={`/lab/r/${c.result_report_id}`} className="font-mono text-lime hover:underline">
                {d.result} →
              </Link>
            ) : null}
            {admin && (c.status === "pending" || c.status === "claimed") ? (
              <>
                <form action={setCommandStatus.bind(null, c.id, "done")}>
                  <button className="font-mono text-muted hover:text-fg">{d.markDone}</button>
                </form>
                <form action={setCommandStatus.bind(null, c.id, "cancelled")}>
                  <button className="font-mono text-muted hover:text-rose">{d.cancel}</button>
                </form>
              </>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CommandForm({ d, reportId, project, agent }: { d: Dict; reportId?: string; project?: string; agent?: string | null }) {
  return (
    <form action={queueCommand} className="flex flex-col gap-2">
      {reportId ? <input type="hidden" name="report_id" value={reportId} /> : null}
      {project ? <input type="hidden" name="project" value={project} /> : null}
      <textarea name="body" required rows={3} placeholder={d.nextStepHint} className="input resize-y" />
      <div className="flex gap-2">
        <input name="agent" defaultValue={agent ?? ""} placeholder={d.agentOptional} className="input max-w-[14rem] font-mono text-sm" />
        <button className="btn btn-lime ml-auto shrink-0">{d.send} ↵</button>
      </div>
    </form>
  );
}
