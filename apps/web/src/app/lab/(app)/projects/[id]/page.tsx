import Link from "next/link";
import { Markdown } from "@/components/Markdown";
import { ProblemState } from "@/components/ProblemState";
import { RunList } from "@/components/RunList";
import { Chip } from "@/components/Status";
import { api } from "@/lib/api";
import { attempt } from "@/lib/attempt";
import { ago, fmtDate } from "@/lib/format";
import { categoryLabel, type NoteListItem, type Project, type RunListItem, type SavedQuery } from "@/lib/types";
import { createNote } from "../../../workspace-actions";

export const metadata = { title: "Project" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [res, notesRes, queriesRes] = await Promise.all([
    attempt(() => Promise.all([api<Project>(`/v1/projects/${id}`), api<RunListItem[]>(`/v1/projects/${id}/runs`)])),
    attempt(() => api<NoteListItem[]>(`/v1/projects/${id}/notes`)),
    attempt(() => api<SavedQuery[]>(`/v1/projects/${id}/queries`)),
  ]);
  if (!res.ok) return <ProblemState problem={res.problem} />;
  const [p, runs] = res.data;
  // Notes/queries failing (e.g. migration not applied yet) must not take the whole project page down.
  const notes = notesRes.ok ? notesRes.data : [];
  const queries = queriesRes.ok ? queriesRes.data : [];
  const workspaceError = !notesRes.ok || !queriesRes.ok;
  const charted = queries.filter((q) => q.chart).length;
  const newNote = createNote.bind(null, p.id);
  const failed = runs.filter((r) => r.status === "failed").length;
  return (
    <>
      <Link href="/lab/projects" className="text-[14px] text-muted hover:text-ink">
        Projects
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">{p.name}</h1>
          {p.summary && <p className="mt-1 max-w-[70ch] text-muted">{p.summary}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/lab/projects/${p.id}/workspace`} className="btn">
            Workspace
          </Link>
          <Link href={`/lab/projects/${p.id}/dashboard`} className="btn btn-quiet">
            Dashboard
          </Link>
          <Link href={`/lab/projects/${p.id}/edit`} className="btn btn-quiet">
            Edit
          </Link>
        </div>
      </div>
      <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-[14px]">
        <div>
          <dt className="text-muted">Slug</dt>
          <dd className="font-mono">{p.slug}</dd>
        </div>
        <div>
          <dt className="text-muted">Type</dt>
          <dd>{categoryLabel(p.category)}</dd>
        </div>
        <div>
          <dt className="text-muted">Status</dt>
          <dd className="capitalize">{p.status}</dd>
        </div>
        <div>
          <dt className="text-muted">Visibility</dt>
          <dd>
            {p.visibility === "public" ? (
              <Link href={`/projects/${p.slug}`} className="link">
                Public on portfolio
              </Link>
            ) : (
              "Private"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Updated</dt>
          <dd>{fmtDate(p.updated_at)}</dd>
        </div>
      </dl>
      {p.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {p.tags.map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>
      )}

      <section className="mt-10">
        <h2 className="mb-1 text-[19px] font-bold">Runs</h2>
        <p className="mb-3 text-[14px] text-muted">
          {runs.length} shown{failed ? `, ${failed} failed` : ""}. Failed runs are kept so you can see what went wrong.
        </p>
        {runs.length === 0 ? (
          <div className="sheet p-5">
            <p className="font-semibold">No runs yet</p>
            <p className="mt-1 text-[15px] text-muted">
              Create an{" "}
              <Link href="/lab/settings" className="link">
                agent token
              </Link>{" "}
              for this project, then start a run from Python:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-sunken p-3 font-mono text-[13px]">
              {`from vtcons_lab import LabClient

with LabClient().start_run("${p.slug}", name="first-run") as run:
    run.log_metric("rows", 1000)
    run.log_artifact("report.md")`}
            </pre>
          </div>
        ) : (
          <RunList runs={runs} />
        )}
      </section>

      {workspaceError && (
        <p role="status" className="mt-10 rounded-lg bg-run/10 px-3 py-2 text-[14.5px] text-run">
          Notes and queries could not be loaded right now. Runs below are unaffected.
        </p>
      )}
      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="notes-h">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 id="notes-h" className="text-[19px] font-bold">
                Notes
              </h2>
              <p className="text-[14px] text-muted">Working notes you fill in as you go, next to the SQL. Autosaved.</p>
            </div>
          </div>
          {notes.length > 0 && (
            <ul className="mb-4 divide-y divide-line border-y border-line">
              {notes.map((n) => (
                <li key={n.id}>
                  <Link href={`/lab/projects/${p.id}/workspace?note=${n.id}`} className="flex items-center justify-between gap-3 px-1 py-3 hover:bg-sunken">
                    <span className="min-w-0 truncate font-semibold">{n.title}</span>
                    <span className="tnum shrink-0 text-[13.5px] text-muted" title={n.updated_at}>
                      {ago(n.updated_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <form action={newNote} className="flex flex-wrap gap-2">
            <button type="submit" name="template" value="working" className="btn">
              New working notes
            </button>
            <button type="submit" name="template" value="blank" className="btn btn-quiet">
              Blank note
            </button>
          </form>
        </section>

        <section aria-labelledby="queries-h">
          <div className="mb-3">
            <h2 id="queries-h" className="text-[19px] font-bold">
              Queries
            </h2>
            <p className="text-[14px] text-muted">
              Saved SQL, run live (read-only).{" "}
              {charted > 0 && (
                <Link href={`/lab/projects/${p.id}/dashboard`} className="link">
                  {charted} on the dashboard
                </Link>
              )}
            </p>
          </div>
          {queries.length > 0 && (
            <ul className="mb-4 divide-y divide-line border-y border-line">
              {queries.map((q) => (
                <li key={q.id}>
                  <Link href={`/lab/projects/${p.id}/workspace?query=${q.id}`} className="block px-1 py-3 hover:bg-sunken">
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate font-semibold">{q.name}</span>
                      {q.chart && <span className="shrink-0 text-[12.5px] text-accent">chart</span>}
                    </span>
                    {q.description && <span className="block truncate text-[13.5px] text-muted">{q.description}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/lab/projects/${p.id}/workspace?query=new`} className="btn btn-quiet">
            New query
          </Link>
        </section>
      </div>

      {p.description && (
        <section className="mt-12 border-t border-line pt-6">
          <h2 className="mb-4 text-[19px] font-bold">Write-up</h2>
          <Markdown text={p.description} />
        </section>
      )}
    </>
  );
}
