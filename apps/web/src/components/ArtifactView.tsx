import { Markdown } from "./Markdown";
import { PlotlyChart } from "./PlotlyChart";
import { StatusDot } from "./Status";
import { api } from "@/lib/api";
import { attempt } from "@/lib/attempt";
import { bytes } from "@/lib/format";
import type { Artifact, ArtifactPreview } from "@/lib/types";

const KIND_LABEL: Record<string, string> = { image: "Image", csv: "Table", markdown: "Report", plotly: "Chart" };

export function Preview({ a, p }: { a: Artifact; p: ArtifactPreview }) {
  if (p.kind === "image" && p.url) {
    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL on the API/storage origin
    return <img src={p.url} alt={a.description || a.name} className="mx-auto max-h-[640px] w-auto max-w-full rounded-lg bg-white" loading="lazy" />;
  }
  if (p.kind === "csv" && p.columns) {
    return (
      <div>
        <div className="max-h-[480px] overflow-auto rounded-lg border border-line" tabIndex={0} role="region" aria-label={`${a.name} preview`}>
          <table className="tnum w-full border-collapse text-[13.5px]">
            <thead className="sticky top-0 bg-sunken">
              <tr>
                {p.columns.map((c, i) => (
                  <th key={i} scope="col" className="whitespace-nowrap border-b border-line px-3 py-2 text-left font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(p.rows ?? []).map((r, i) => (
                <tr key={i} className="odd:bg-surface even:bg-sunken/40">
                  {r.map((cell, j) => (
                    <td key={j} className="whitespace-nowrap border-b border-line px-3 py-1.5">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint mt-2">
          First {p.rows?.length ?? 0} rows{p.truncated ? " — download the file for the rest" : ""}.
        </p>
      </div>
    );
  }
  if (p.kind === "markdown" && p.text != null) {
    return (
      <div>
        <Markdown text={p.text} />
        {p.truncated && <p className="hint mt-2">Preview cut off. Download the file for the full report.</p>}
      </div>
    );
  }
  if (p.kind === "plotly" && p.figure) {
    return <PlotlyChart figure={p.figure} title={a.description || a.name} />;
  }
  return <p className="text-muted">No preview for this file type.</p>;
}

export async function ArtifactView({ artifact: a }: { artifact: Artifact }) {
  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="break-all font-semibold">{a.name}</h3>
        <p className="text-[13.5px] text-muted">
          {KIND_LABEL[a.kind] ?? a.kind} · {bytes(a.size_bytes)}
          {a.description ? ` · ${a.description}` : ""}
        </p>
      </div>
      {a.status === "ready" ? (
        <a href={`/lab/artifacts/${a.id}/download`} className="btn btn-quiet min-h-10 px-3 text-[14px]">
          Download
        </a>
      ) : (
        <StatusDot status={a.status} />
      )}
    </div>
  );
  if (a.status !== "ready") {
    return (
      <article className="sheet p-4 md:p-5">
        {header}
        <p className="mt-3 text-[14.5px] text-muted">
          {a.status === "failed" ? `Rejected: ${a.failure_reason ?? "verification failed"}` : "Registered, but the upload never finished."}
        </p>
      </article>
    );
  }
  const res = await attempt(() => api<ArtifactPreview>(`/v1/artifacts/${a.id}/preview`));
  return (
    <article className="sheet p-4 md:p-5">
      {header}
      <div className="mt-4">{res.ok ? <Preview a={a} p={res.data} /> : <p className="text-muted">Preview unavailable: {res.problem.detail}</p>}</div>
    </article>
  );
}
