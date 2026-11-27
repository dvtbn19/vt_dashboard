import Link from "next/link";
import { Preview } from "./ArtifactView";
import { Markdown } from "./Markdown";
import { PlotlyChart } from "./PlotlyChart";
import { Chip } from "./Status";
import { fmtDate, num } from "@/lib/format";
import type { RunDashboardData } from "@/lib/runDashboard";
import { chartCaption, chartLabel, chartNumber, humanize, isCompact, metricGrid, parseStory, pickStory, splitLead } from "@/lib/runStory";
import type { Artifact, ArtifactPreview, Metric } from "@/lib/types";

type Figure = { data: unknown[]; layout: Record<string, unknown> };
type Chart = { artifact: Artifact; figure: Figure; n: number | null };

const KIND_LABEL: Record<string, string> = { image: "Image", csv: "Table", markdown: "Report", plotly: "Chart" };

function fmtMetric(m: Metric): string {
  if (!/(^|_)(pct|percent)$/i.test(m.key)) return num(m.value);
  const v = Math.round(m.value * 10) / 10;
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
}

function MetricsBlock({ metrics }: { metrics: Metric[] }) {
  const grid = metricGrid(metrics);
  if (grid) {
    return (
      <div className="sheet overflow-x-auto p-0">
        <table className="tnum w-full min-w-[420px] border-collapse text-[15px]">
          <thead>
            <tr>
              <th scope="col" className="border-b border-line px-4 py-2.5 text-left text-[12.5px] font-semibold uppercase tracking-[0.05em] text-muted">
                &nbsp;
              </th>
              {grid.columns.map((c) => (
                <th key={c} scope="col" className="border-b border-line px-4 py-2.5 text-right text-[12.5px] font-semibold uppercase tracking-[0.05em] text-muted">
                  {humanize(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((r) => (
              <tr key={r} className="border-b border-line last:border-0">
                <th scope="row" className="px-4 py-2.5 text-left font-semibold">
                  {humanize(r)}
                </th>
                {grid.columns.map((c) => {
                  const m = grid.value(r, c);
                  return (
                    <td key={c} className={`px-4 py-2.5 text-right font-semibold ${m && m.value < 0 ? "text-fail" : ""}`} title={m ? `${m.key} = ${m.value}` : undefined}>
                      {m ? fmtMetric(m) : "–"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const latest = new Map<string, Metric>();
  for (const m of metrics) if ((m.step ?? 0) >= (latest.get(m.key)?.step ?? 0)) latest.set(m.key, m);
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {[...latest.values()].map((m) => (
        <div key={m.key} className="sheet min-w-0 px-4 py-3">
          <dt className="truncate text-[13px] text-muted" title={m.key}>
            {humanize(m.key)}
          </dt>
          <dd className={`tnum truncate text-[24px] font-bold leading-tight ${m.value < 0 && /pct|percent/i.test(m.key) ? "text-fail" : ""}`}>{fmtMetric(m)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ChartFigure({ c }: { c: Chart }) {
  return (
    <figure id={c.n !== null ? `chart-${c.n}` : undefined} className="sheet min-w-0 scroll-mt-6 p-3 md:p-4">
      <figcaption className="mb-2 flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-baseline gap-2">
          {c.n !== null && (
            <span className="tnum inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-sunken px-1.5 text-[12.5px] font-bold">
              {chartLabel(c.artifact) ?? c.n}
            </span>
          )}
          <span className="text-[14px] font-semibold leading-snug">{chartCaption(c.artifact)}</span>
        </span>
        <a href={`/lab/artifacts/${c.artifact.id}/download`} className="shrink-0 text-[13px] text-muted hover:text-ink" title={`Download ${c.artifact.name}`}>
          Download
        </a>
      </figcaption>
      <PlotlyChart figure={c.figure} title={chartCaption(c.artifact)} />
    </figure>
  );
}

function FileDetails({ a, p }: { a: Artifact; p: { ok: true; preview: ArtifactPreview } | { ok: false; error: string } | undefined }) {
  return (
    <details className="sheet group p-4">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 marker:hidden">
        <span className="min-w-0">
          <span className="mr-2 inline-block text-muted transition-transform group-open:rotate-90">›</span>
          <span className="font-semibold">{a.description || a.name}</span>
          <span className="block pl-5 text-[13px] text-muted">
            {KIND_LABEL[a.kind] ?? a.kind} · {a.name}
          </span>
        </span>
        <a href={`/lab/artifacts/${a.id}/download`} className="shrink-0 text-[13px] text-muted hover:text-ink">
          Download
        </a>
      </summary>
      <div className="mt-4">{p?.ok ? <Preview a={a} p={p.preview} /> : <p className="text-muted">Preview unavailable{p ? `: ${p.error}` : "."}</p>}</div>
    </details>
  );
}

/** A long section: its opening text, then its charts (two per row on wide screens), then the detail. */
function SplitSection({ body, items }: { body: string; items: Chart[] }) {
  const { lead, tail } = splitLead(body);
  const pair = items.length > 1;
  return (
    <div className="space-y-6">
      {lead && (
        <div className="min-w-0 max-w-[90ch] text-[15px]">
          <Markdown text={lead} />
        </div>
      )}
      <div className={`grid min-w-0 gap-5 ${pair ? "2xl:grid-cols-2" : ""}`}>
        {items.map((c) => (
          <ChartFigure key={c.artifact.id} c={c} />
        ))}
      </div>
      {tail && (
        <div className="min-w-0 text-[15px]">
          <Markdown text={tail} />
        </div>
      )}
    </div>
  );
}

/** A run shown as a dashboard: its story section by section, each with the charts it refers to. */
export function RunDashboard({ data }: { data: RunDashboardData }) {
  const run = data.run!;
  const ready = run.artifacts.filter((a) => a.status === "ready");
  const pv = (a: Artifact) => data.previews[a.id];

  const charts: Chart[] = [];
  for (const a of ready) {
    const p = pv(a);
    if (a.kind === "plotly" && p?.ok && p.preview.figure) charts.push({ artifact: a, figure: p.preview.figure as Figure, n: chartNumber(a) });
  }
  charts.sort((x, y) => (x.n ?? 1e9) - (y.n ?? 1e9) || x.artifact.name.localeCompare(y.artifact.name));
  // Several files can share a number ("3a", "3b" are both chart 3).
  const byNumber = new Map<number, Chart[]>();
  for (const c of charts) if (c.n !== null) byNumber.set(c.n, [...(byNumber.get(c.n) ?? []), c]);

  const docs = ready
    .filter((a) => a.kind === "markdown")
    .map((a) => {
      const p = pv(a);
      return { artifact: a, text: p?.ok ? (p.preview.text ?? "") : "" };
    })
    .filter((d) => d.text);
  const storyDoc = pickStory(docs);
  const story = storyDoc ? parseStory(storyDoc.text) : null;

  const shown = new Set<Chart>();
  const sections = (story?.sections ?? []).map((s) => {
    const cs = s.charts.flatMap((n) => byNumber.get(n) ?? []).filter((c): c is Chart => !!c && !shown.has(c));
    cs.forEach((c) => shown.add(c));
    return { ...s, items: cs };
  });
  const rest = charts.filter((c) => !shown.has(c));
  // A report that never names its charts: show them first, it is a dashboard.
  const chartsFirst = shown.size === 0;
  const chartsBlock = (
    <>
      {rest.length > 0 && (
        <section className="mt-12" aria-labelledby="rd-charts">
          <h2 id="rd-charts" className="mb-5 border-b border-line pb-2 text-[21px] font-bold tracking-tight">
            {chartsFirst ? "Charts" : "More charts"}
          </h2>
          <div className={`grid min-w-0 gap-5 ${rest.length > 1 ? "2xl:grid-cols-2" : ""}`}>
            {rest.map((c) => (
              <ChartFigure key={c.artifact.id} c={c} />
            ))}
          </div>
        </section>
      )}
    </>
  );
  const files = ready.filter((a) => a !== storyDoc?.artifact && !charts.some((c) => c.artifact === a));
  const params = Object.entries(run.params);
  const synthetic = run.tags.includes("synthetic") || /synthetic|tổng hợp|demo/i.test(story?.intro ?? "");

  return (
    <article className="mx-auto max-w-[1320px]">
      <header className="relative overflow-hidden rounded-2xl border border-line bg-surface px-5 py-7 md:px-9 md:py-10">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/10 blur-2xl" />
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-accent">Run dashboard · {run.project.name}</p>
        <h1 className="mt-3 max-w-[30ch] text-[30px] font-bold leading-[1.12] tracking-tight md:text-[40px]">{story?.title || run.name}</h1>
        {story?.intro && <div className="mt-4 max-w-[75ch] text-[15.5px] text-muted">{<Markdown text={story.intro} />}</div>}
        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-[13.5px]">
          <div>
            <dt className="text-muted">Run</dt>
            <dd className="font-semibold">
              <Link href={`/lab/runs/${run.id}`} className="link">
                {run.name}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-muted">Finished</dt>
            <dd className="font-semibold">{fmtDate(run.finished_at ?? run.started_at)}</dd>
          </div>
          <div>
            <dt className="text-muted">Published by</dt>
            <dd className="font-semibold">{run.created_by ?? run.source}</dd>
          </div>
          <div>
            <dt className="text-muted">Charts</dt>
            <dd className="tnum font-semibold">{charts.length}</dd>
          </div>
        </dl>
        {synthetic && (
          <div className="mt-4">
            <Chip tone="warn">Synthetic data</Chip>
          </div>
        )}
      </header>

      {run.metrics.length > 0 && (
        <section className="mt-10" aria-labelledby="rd-metrics">
          <h2 id="rd-metrics" className="mb-4 border-b border-line pb-2 text-[20px] font-bold tracking-tight">
            Key numbers
          </h2>
          <MetricsBlock metrics={run.metrics} />
        </section>
      )}

      {chartsFirst && chartsBlock}

      {sections.map((s, i) => (
        <section key={i} className="mt-12" aria-labelledby={`rd-s${i}`}>
          <h2 id={`rd-s${i}`} className="mb-5 border-b border-line pb-2 text-[21px] font-bold tracking-tight md:text-[23px]">
            {s.heading}
          </h2>
          {s.items.length && isCompact(s.body) ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
              {s.body && (
                <div className="min-w-0 text-[15px] xl:sticky xl:top-6 xl:self-start">
                  <Markdown text={s.body} />
                </div>
              )}
              <div className={`min-w-0 space-y-5 ${s.body ? "" : "xl:col-span-2"}`}>
                {s.items.map((c) => (
                  <ChartFigure key={c.artifact.id} c={c} />
                ))}
              </div>
            </div>
          ) : s.items.length ? (
            <SplitSection body={s.body} items={s.items} />
          ) : (
            s.body && (
              <div className="min-w-0 text-[15px]">
                <Markdown text={s.body} />
              </div>
            )
          )}
        </section>
      ))}


      {!chartsFirst && chartsBlock}

      {(files.length > 0 || params.length > 0) && (
        <section className="mt-12" aria-labelledby="rd-files">
          <h2 id="rd-files" className="mb-5 border-b border-line pb-2 text-[21px] font-bold tracking-tight">
            Data and method
          </h2>
          <div className="space-y-3">
            {files.map((a) => (
              <FileDetails key={a.id} a={a} p={pv(a)} />
            ))}
            {params.length > 0 && (
              <details className="sheet group p-4">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  <span className="mr-2 inline-block text-muted transition-transform group-open:rotate-90">›</span>
                  Run parameters ({params.length})
                </summary>
                <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[14px] sm:grid-cols-[max-content_1fr]">
                  {params.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="font-mono text-muted">{k}</dt>
                      <dd className="break-words">{typeof v === "string" ? v : JSON.stringify(v)}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
          </div>
        </section>
      )}

      <footer className="mt-14 border-t border-line pt-4 text-[13px] text-muted">
        Charts and tables are the files published by run “{run.name}”
        {storyDoc ? `; the text comes from ${storyDoc.artifact.name}` : ""}.
      </footer>
    </article>
  );
}
