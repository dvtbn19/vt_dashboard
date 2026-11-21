import Link from "next/link";
import { EvidenceFigure } from "./EvidenceFigure";
import { Markdown } from "./Markdown";
import { fmtDate, num } from "@/lib/format";
import {
  filledRows,
  findSection,
  isNumberColumn,
  parseNote,
  sectionTable,
  sectionText,
  type NoteDoc,
  type Section,
  type TableBlock,
} from "@/lib/noteDoc";
import type { PresentationData } from "@/lib/presentation";
import { categoryLabel, type Metric, type SavedQuery } from "@/lib/types";

// ------------------------------------------------------------------ helpers

function col(t: TableBlock, re: RegExp, fallback: number): number {
  const i = t.columns.findIndex((c) => re.test(c));
  if (i >= 0) return i;
  const offset = isNumberColumn(t.columns[0]) ? 1 : 0;
  return fallback + offset < t.columns.length ? fallback + offset : -1;
}

type Finding = { text: string; soWhat: string; ref: string };

function findingsOf(doc: NoteDoc | null): Finding[] {
  const t = sectionTable(findSection(doc ?? { heading: "", intro: "", sections: [] }, "findings"));
  if (!t) return [];
  const fi = col(t, /finding|phát hiện/i, 0);
  const si = col(t, /so what|ý nghĩa|vì sao|tác động/i, 1);
  const ri = t.columns.findIndex((c) => /query|file|sql|nguồn|source/i.test(c));
  return filledRows(t).map((r) => ({ text: r[fi] ?? "", soWhat: si >= 0 ? (r[si] ?? "") : "", ref: ri >= 0 ? (r[ri] ?? "") : "" }));
}

/** "1. a\n2. b" or "- a\n- b" → items; otherwise paragraphs. */
function listItems(text: string): string[] {
  const lines = text.split("\n");
  const marker = /^\s*(\d+[.)]|[-*•])\s+/;
  if (lines.some((l) => marker.test(l))) {
    const items: string[] = [];
    for (const l of lines) {
      if (marker.test(l)) items.push(l.replace(marker, ""));
      else if (l.trim() && items.length) items[items.length - 1] += " " + l.trim();
      else if (l.trim()) items.push(l.trim());
    }
    return items.filter((x) => x.trim());
  }
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function metricLabel(key: string): string {
  const pct = /_pct$|_percent$/i.test(key);
  const base = key.replace(/_(pct|percent)$/i, "").replace(/_/g, " ");
  return `${base.charAt(0).toUpperCase()}${base.slice(1)}${pct ? " (%)" : ""}`;
}

function metricValue(m: Metric): string {
  const pct = /_pct$|_percent$/i.test(m.key);
  if (!pct) return num(m.value);
  const v = Math.round(m.value * 10) / 10;
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function latestByKey(metrics: Metric[]): Metric[] {
  const m = new Map<string, Metric>();
  for (const x of metrics) {
    const prev = m.get(x.key);
    if (!prev || (x.step ?? 0) >= (prev.step ?? 0)) m.set(x.key, x);
  }
  return [...m.values()];
}

function Heading({ n, children, id }: { n: string; children: React.ReactNode; id: string }) {
  return (
    <div className="mb-5 flex items-baseline gap-3 border-b border-line pb-2">
      <span className="tnum text-[13px] font-semibold text-accent">{n}</span>
      <h2 id={id} className="text-[21px] font-bold tracking-tight md:text-[24px]">
        {children}
      </h2>
    </div>
  );
}

function SimpleTable({ t }: { t: TableBlock }) {
  const rows = filledRows(t);
  if (!rows.length) return null;
  const cols = t.columns.map((c, i) => ({ c, i })).filter(({ i }) => !(isNumberColumn(t.columns[0]) && i === 0));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-[14px]">
        <thead>
          <tr>
            {cols.map(({ c, i }) => (
              <th key={i} scope="col" className="border-b border-line py-2 pr-4 text-left align-bottom text-[12.5px] font-semibold uppercase tracking-[0.05em] text-muted">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-line align-top last:border-0">
              {cols.map(({ i }) => (
                <td key={i} className="whitespace-pre-line py-2.5 pr-4">
                  {r[i]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AppendixSection({ s }: { s: Section }) {
  const text = sectionText(s);
  const tables = s.blocks.filter((b): b is TableBlock => b.kind === "table");
  if (!text && tables.every((t) => !filledRows(t).length)) return null;
  return (
    <details className="sheet group p-4 md:p-5">
      <summary className="cursor-pointer list-none text-[16px] font-bold marker:hidden">
        <span className="mr-2 inline-block text-muted transition-transform group-open:rotate-90">›</span>
        {s.title}
      </summary>
      <div className="mt-3 space-y-3">
        {text && <Markdown text={text} />}
        {tables.map((t, i) => (
          <SimpleTable key={i} t={t} />
        ))}
      </div>
    </details>
  );
}

// ------------------------------------------------------------------ page

export function Presentation({ data, mode }: { data: PresentationData; mode: "app" | "present" }) {
  const { project, note, queries, engine, metrics, metricsRun } = data;
  const doc = note ? parseNote(note.body) : null;
  const byId = new Map(queries.map((q) => [q.id, q]));
  const links = (note?.links ?? []).filter((l) => byId.has(l.query_id));

  const findingsSection = doc ? findSection(doc, "findings") : undefined;
  const findings = findingsOf(doc);
  const request = doc ? sectionText(findSection(doc, "request")) : "";
  const recs = doc ? listItems(sectionText(findSection(doc, "recommendations"))) : [];

  // Exhibits: queries linked to findings first, then other charted queries.
  const exhibit: SavedQuery[] = [];
  const add = (q: SavedQuery | undefined) => q && !exhibit.includes(q) && exhibit.push(q);
  links.filter((l) => findingsSection && l.section === findingsSection.title).forEach((l) => add(byId.get(l.query_id)));
  const evidenceCount = exhibit.length;
  links.forEach((l) => {
    const q = byId.get(l.query_id);
    if (q?.chart) add(q);
  });
  queries.filter((q) => q.chart).forEach(add);
  const numberOf = (id: string) => exhibit.findIndex((q) => q.id === id) + 1;

  // A finding row mentioning a linked query by name gets a pointer to its exhibit.
  const refsFor = (f: Finding) =>
    exhibit.filter((q) => (f.ref + " " + f.text).toLowerCase().includes(q.name.toLowerCase())).map((q) => numberOf(q.id));

  const kpis = latestByKey(metrics);
  const appendix = doc ? doc.sections.filter((s) => roleOf(doc, s) === null) : [];
  const editBase = `/lab/projects/${project.id}/workspace${note ? `?note=${note.id}&` : "?"}query=`;
  let n = 0;
  const next = () => String(++n).padStart(2, "0");

  return (
    <article className="mx-auto max-w-[1120px]">
      {/* cover */}
      <header className="relative overflow-hidden rounded-2xl border border-line bg-surface px-5 py-8 md:px-10 md:py-12">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/10 blur-2xl" />
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-accent">
          {categoryLabel(project.category)} · {project.status}
        </p>
        <h1 className="mt-3 max-w-[22ch] text-[32px] font-bold leading-[1.1] tracking-tight md:text-[46px]">{project.name}</h1>
        {project.summary && <p className="mt-4 max-w-[62ch] text-[17px] text-muted md:text-[18.5px]">{project.summary}</p>}
        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-[13.5px]">
          <div>
            <dt className="text-muted">Updated</dt>
            <dd className="font-semibold">{fmtDate(note?.updated_at ?? project.updated_at)}</dd>
          </div>
          <div>
            <dt className="text-muted">Findings</dt>
            <dd className="tnum font-semibold">{findings.length}</dd>
          </div>
          <div>
            <dt className="text-muted">Exhibits</dt>
            <dd className="tnum font-semibold">{exhibit.length}</dd>
          </div>
          <div>
            <dt className="text-muted">Data</dt>
            <dd className="font-semibold">{engine.configured ? "Live, read-only SQL" : "Not connected"}</dd>
          </div>
        </dl>
      </header>

      {!note && (
        <div className="sheet mt-8 p-5">
          <p className="font-semibold">No working notes yet</p>
          <p className="mt-1 text-[15px] text-muted">
            Findings and recommendations come from the project&apos;s working notes (sections 6 and 7). Open the workspace to start them.
          </p>
          {mode === "app" && (
            <Link href={`/lab/projects/${project.id}/workspace`} className="btn mt-4">
              Open workspace
            </Link>
          )}
        </div>
      )}

      {request && (
        <section className="mt-12" aria-labelledby="p-question">
          <Heading n={next()} id="p-question">
            The question
          </Heading>
          <div className="max-w-[75ch] border-l-4 border-accent pl-5 text-[16.5px]">
            <Markdown text={request} />
          </div>
        </section>
      )}

      {kpis.length > 0 && (
        <section className="mt-12" aria-labelledby="p-kpi">
          <Heading n={next()} id="p-kpi">
            Key numbers
          </Heading>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {kpis.slice(0, 8).map((m) => (
              <div key={m.key} className="sheet min-w-0 break-inside-avoid px-4 py-4">
                <dt className="line-clamp-2 min-h-[2.6em] text-[13px] leading-snug text-muted" title={m.key}>
                  {metricLabel(m.key)}
                </dt>
                <dd
                  className={`tnum mt-1 truncate text-[26px] font-bold leading-tight md:text-[30px] ${/_pct$/i.test(m.key) ? (m.value < 0 ? "text-fail" : "text-accent") : ""}`}
                  title={String(m.value)}
                >
                  {metricValue(m)}
                </dd>
              </div>
            ))}
          </dl>
          {kpis.length > 8 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[14px] text-muted hover:text-ink">All {kpis.length} numbers</summary>
              <dl className="mt-3 grid gap-x-8 gap-y-1 text-[14px] sm:grid-cols-2">
                {kpis.slice(8).map((m) => (
                  <div key={m.key} className="flex justify-between gap-4 border-b border-line py-1.5">
                    <dt className="text-muted">{metricLabel(m.key)}</dt>
                    <dd className="tnum font-semibold">{metricValue(m)}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
          {metricsRun && (
            <p className="hint mt-2">
              From run{" "}
              {mode === "app" ? (
                <Link href={`/lab/runs/${metricsRun.id}`} className="link">
                  {metricsRun.name}
                </Link>
              ) : (
                metricsRun.name
              )}
              {metricsRun.finished_at ? `, ${fmtDate(metricsRun.finished_at)}` : ""}.
            </p>
          )}
        </section>
      )}

      {findings.length > 0 && (
        <section className="mt-12" aria-labelledby="p-findings">
          <Heading n={next()} id="p-findings">
            Key findings
          </Heading>
          <ol className="grid gap-3 md:grid-cols-2">
            {findings.map((f, i) => {
              const refs = refsFor(f);
              return (
                <li key={i} className="sheet flex min-w-0 break-inside-avoid gap-4 p-4 md:p-5">
                  <span className="tnum flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-[15px] font-bold text-accent-ink">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15.5px] font-semibold leading-snug [&_.prose-lab]:text-[15.5px] [&_p]:mb-0">
                      <Markdown text={f.text} />
                    </div>
                    {f.soWhat && (
                      <div className="mt-2 text-[14.5px] text-muted [&_.prose-lab]:text-[14.5px] [&_p]:mb-0">
                        <span className="font-semibold text-ink">So what: </span>
                        <Markdown text={f.soWhat} />
                      </div>
                    )}
                    {refs.length > 0 && (
                      <p className="mt-2 text-[13px]">
                        {refs.map((r) => (
                          <a key={r} href={`#fig-${r}`} className="mr-2 text-accent hover:underline">
                            See exhibit {r}
                          </a>
                        ))}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {exhibit.length > 0 && engine.configured && (
        <section className="mt-12" aria-labelledby="p-evidence">
          <Heading n={next()} id="p-evidence">
            {evidenceCount > 0 ? "Evidence" : "Analysis"}
          </Heading>
          <div className="grid gap-5 lg:grid-cols-2">
            {exhibit.map((q, i) => (
              <EvidenceFigure key={q.id} query={q} number={i + 1} editHref={mode === "app" ? editBase + q.id : undefined} />
            ))}
          </div>
        </section>
      )}

      {recs.length > 0 && (
        <section className="mt-12" aria-labelledby="p-recs">
          <Heading n={next()} id="p-recs">
            Recommendations
          </Heading>
          <ol className="space-y-3">
            {recs.map((r, i) => (
              <li key={i} className="flex break-inside-avoid gap-4 rounded-xl border border-accent/30 bg-accent/5 p-4">
                <span className="tnum shrink-0 text-[22px] font-bold leading-none text-accent">{i + 1}</span>
                <div className="min-w-0 text-[15.5px] [&_p]:mb-0">
                  <Markdown text={r} />
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {appendix.length > 0 && (
        <section className="mt-12" aria-labelledby="p-appendix">
          <Heading n={next()} id="p-appendix">
            Method and appendix
          </Heading>
          <div className="space-y-3">
            {appendix.map((s, i) => (
              <AppendixSection key={i} s={s} />
            ))}
          </div>
        </section>
      )}

      <footer className="mt-14 border-t border-line pt-4 text-[13px] text-muted">
        {note ? `Based on “${note.title}” (v${note.version}, ${fmtDate(note.updated_at)}). ` : ""}
        Exhibits are computed live from read-only SQL each time this page opens.
      </footer>
    </article>
  );
}

function roleOf(doc: NoteDoc, s: Section): string | null {
  for (const r of ["findings", "recommendations", "request"] as const) if (findSection(doc, r) === s) return r;
  return null;
}
