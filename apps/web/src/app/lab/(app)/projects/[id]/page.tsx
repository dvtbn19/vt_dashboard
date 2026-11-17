import Link from "next/link";
import { Markdown } from "@/components/Markdown";
import { ProblemState } from "@/components/ProblemState";
import { RunList } from "@/components/RunList";
import { Chip } from "@/components/Status";
import { api } from "@/lib/api";
import { attempt } from "@/lib/attempt";
import { fmtDate } from "@/lib/format";
import { categoryLabel, type Project, type RunListItem } from "@/lib/types";

export const metadata = { title: "Project" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await attempt(() => Promise.all([api<Project>(`/v1/projects/${id}`), api<RunListItem[]>(`/v1/projects/${id}/runs`)]));
  if (!res.ok) return <ProblemState problem={res.problem} />;
  const [p, runs] = res.data;
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
        <Link href={`/lab/projects/${p.id}/edit`} className="btn btn-quiet">
          Edit
        </Link>
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

      {p.description && (
        <section className="mt-12 border-t border-line pt-6">
          <h2 className="mb-4 text-[19px] font-bold">Write-up</h2>
          <Markdown text={p.description} />
        </section>
      )}
    </>
  );
}
