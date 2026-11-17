import Link from "next/link";
import { ArtifactView } from "@/components/ArtifactView";
import { Metrics } from "@/components/Metrics";
import { ProblemState } from "@/components/ProblemState";
import { Chip, StatusDot } from "@/components/Status";
import { api } from "@/lib/api";
import { attempt } from "@/lib/attempt";
import { duration, fmtDate } from "@/lib/format";
import type { RunDetail } from "@/lib/types";

export const metadata = { title: "Run" };

const ORDER = { image: 0, plotly: 1, markdown: 2, csv: 3 } as const;

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await attempt(() => api<RunDetail>(`/v1/runs/${id}`));
  if (!res.ok) return <ProblemState problem={res.problem} />;
  const run = res.data;
  const artifacts = [...run.artifacts].sort((a, b) => (ORDER[a.kind] ?? 9) - (ORDER[b.kind] ?? 9));
  const params_ = Object.entries(run.params);
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-[14px] text-muted">
        <Link href="/lab/projects" className="hover:text-ink">
          Projects
        </Link>{" "}
        /{" "}
        <Link href={`/lab/projects/${run.project.id}`} className="hover:text-ink">
          {run.project.name}
        </Link>
      </nav>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h1 className="break-all text-[26px] font-bold leading-tight tracking-tight">{run.name}</h1>
        <StatusDot status={run.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 text-[14px] sm:flex sm:flex-wrap">
        <div>
          <dt className="text-muted">Started</dt>
          <dd className="tnum">{fmtDate(run.started_at)}</dd>
        </div>
        <div>
          <dt className="text-muted">Duration</dt>
          <dd className="tnum">{duration(run.started_at, run.finished_at)}</dd>
        </div>
        <div>
          <dt className="text-muted">Published by</dt>
          <dd>{run.created_by ?? run.source}</dd>
        </div>
        {run.git_commit && (
          <div>
            <dt className="text-muted">Commit</dt>
            <dd className="font-mono" title={run.git_commit}>
              {run.git_commit.slice(0, 10)}
            </dd>
          </div>
        )}
        {run.dataset_version && (
          <div>
            <dt className="text-muted">Dataset</dt>
            <dd className="break-all">{run.dataset_version}</dd>
          </div>
        )}
      </dl>
      {run.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {run.tags.map((t) => (
            <Chip key={t} tone={t === "synthetic" ? "warn" : "plain"}>
              {t}
            </Chip>
          ))}
        </div>
      )}
      {run.notes && <p className="mt-4 max-w-[75ch] text-[15px] text-muted">{run.notes}</p>}

      {run.status === "failed" && run.error && (
        <section className="mt-6 rounded-xl border border-fail/40 bg-fail/6 p-4">
          <h2 className="font-semibold text-fail">Error</h2>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-[12.5px]">{run.error}</pre>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-[19px] font-bold">Metrics</h2>
        {run.metrics.length === 0 ? <p className="text-muted">No metrics were logged for this run.</p> : <Metrics metrics={run.metrics} />}
      </section>

      {params_.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-[15px] font-semibold">Parameters ({params_.length})</summary>
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-[14px] sm:grid-cols-[max-content_1fr]">
            {params_.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-mono text-muted">{k}</dt>
                <dd className="break-all font-mono">{typeof v === "string" ? v : JSON.stringify(v)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-[19px] font-bold">Files</h2>
        {artifacts.length === 0 ? (
          <p className="text-muted">No files yet. Use run.log_artifact(path) to attach images, tables, reports or charts.</p>
        ) : (
          <div className="space-y-5">
            {artifacts.map((a) => (
              <ArtifactView key={a.id} artifact={a} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
