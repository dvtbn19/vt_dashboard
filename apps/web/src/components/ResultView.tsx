"use client";

import { useId, useMemo, useState } from "react";
import { PlotlyChart } from "./PlotlyChart";
import { AGG_LABEL, MEASURES, buildChart, distinctValues, key, numericColumns } from "@/lib/chart";
import { downloadCsv, formatCell } from "@/lib/queryResult";
import type { ChartAgg, ChartFilter, ChartSpec, ChartType, FilterValue, QueryResult } from "@/lib/types";

export function ResultTable({ result }: { result: QueryResult }) {
  if (result.columns.length === 0) return <p className="text-muted">The statement returned no columns.</p>;
  if (result.rows.length === 0) return <p className="text-muted">No rows.</p>;
  return (
    <div className="max-h-[480px] overflow-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-[13.5px]">
        <thead className="sticky top-0 z-10 bg-sunken">
          <tr>
            {result.columns.map((c, i) => (
              <th key={i} scope="col" className="whitespace-nowrap border-b border-line px-3 py-2 text-left font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, ri) => (
            <tr key={ri} className="border-b border-line last:border-0 hover:bg-sunken/60">
              {row.map((v, ci) => (
                <td
                  key={ci}
                  className={`max-w-[360px] truncate px-3 py-1.5 ${typeof v === "number" ? "tnum text-right" : ""} ${v === null ? "text-muted" : ""}`}
                  title={typeof v === "string" && v.length > 40 ? v : undefined}
                >
                  {formatCell(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const MARKS: { type: ChartType; label: string }[] = [
  { type: "bar", label: "Bar" },
  { type: "hbar", label: "Bar ↔" },
  { type: "line", label: "Line" },
  { type: "area", label: "Area" },
  { type: "scatter", label: "Scatter" },
];

function Shelf({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="label !mb-1 text-[13px]" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

const sel = "field !min-h-10 w-full !py-1.5 text-[14px]";

/** One filter: pick which values of a column to keep. */
function FilterEditor({
  result,
  filter,
  onChange,
  onRemove,
}: {
  result: QueryResult;
  filter: ChartFilter;
  onChange: (f: ChartFilter) => void;
  onRemove: () => void;
}) {
  const [q, setQ] = useState("");
  const values = useMemo(() => distinctValues(result, filter.column) ?? [], [result, filter.column]);
  // A filter that keeps nothing or everything was just added (or needs attention): show its values.
  const [open, setOpen] = useState(filter.values.length === 0 || filter.values.length >= values.length);
  const keep = new Set(filter.values.map((v) => key(v)));
  const shown = values.filter((v) => !q || String(v.value).toLowerCase().includes(q.toLowerCase()));
  const toggle = (v: FilterValue) =>
    onChange({ ...filter, values: keep.has(key(v)) ? filter.values.filter((x) => key(x) !== key(v)) : [...filter.values, v] });
  const summary = filter.values.length === 0 ? "none selected" : filter.values.length === values.length ? "all" : `${filter.values.length} of ${values.length}`;
  return (
    <div className="rounded-lg border border-line">
      <div className="flex items-center gap-2 px-2 py-1">
        <button type="button" className="min-h-9 min-w-0 flex-1 truncate text-left text-[14px]" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="font-semibold">{filter.column}</span> <span className="text-muted">· {summary}</span>
        </button>
        <button type="button" className="min-h-9 px-2 text-muted hover:text-fail" onClick={onRemove} aria-label={`Remove filter on ${filter.column}`}>
          ×
        </button>
      </div>
      {open && (
        <div className="border-t border-line p-2">
          <div className="flex flex-wrap items-center gap-2">
            <input className="field !min-h-9 min-w-0 flex-1 !py-1 text-[14px]" placeholder="Search values" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search values" />
            <button type="button" className="text-[13px] underline" onClick={() => onChange({ ...filter, values: values.map((v) => v.value) })}>
              All
            </button>
            <button type="button" className="text-[13px] underline" onClick={() => onChange({ ...filter, values: [] })}>
              None
            </button>
          </div>
          <div className="mt-2 max-h-56 overflow-auto">
            {shown.map((v) => (
              <label key={key(v.value)} className="flex min-h-8 items-center gap-2 text-[14px]">
                <input type="checkbox" className="h-4 w-4 accent-(--accent)" checked={keep.has(key(v.value))} onChange={() => toggle(v.value)} />
                <span className="min-w-0 flex-1 truncate">{v.value === null ? "(null)" : String(v.value)}</span>
                <span className="tnum text-[12.5px] text-muted">{v.count}</span>
              </label>
            ))}
            {shown.length === 0 && <p className="hint">No matching values.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/** Tableau-style shelves: Marks, Columns (X), measures + aggregation, Color, small multiples, sort, filters. */
export function ChartPicker({
  result,
  spec,
  onChange,
}: {
  result: QueryResult;
  spec: ChartSpec | null;
  onChange: (s: ChartSpec | null) => void;
}) {
  const uid = useId(); // several pickers can share a page (notebook cells)
  const nums = numericColumns(result);
  const current: ChartSpec = spec ?? { type: "bar", x: result.columns[0], y: [], agg: "sum" };
  const set = (patch: Partial<ChartSpec>) => {
    const next = { ...current, ...patch };
    onChange(next.y.length ? next : null);
  };
  const filters = current.filters ?? [];
  const filterable = result.columns.filter((c) => !filters.some((f) => f.column === c));
  const dims = result.columns.filter((c) => !current.y.includes(c));
  const stackable = current.type === "bar" || current.type === "hbar" || current.type === "area";
  return (
    <div className="space-y-3 rounded-xl border border-line bg-sunken/40 p-3 text-[14px]">
      <div role="radiogroup" aria-label="Mark type" className="flex flex-wrap gap-1">
        {MARKS.map((m) => (
          <button
            key={m.type}
            type="button"
            role="radio"
            aria-checked={current.type === m.type}
            onClick={() => set({ type: m.type })}
            className={`min-h-9 rounded-md border px-3 text-[14px] ${current.type === m.type ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface hover:border-muted"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Shelf label={current.type === "hbar" ? "Rows (dimension)" : "X / Columns"} htmlFor={`${uid}-cx`}>
          <select className={sel} id={`${uid}-cx`} value={current.x} onChange={(e) => set({ x: e.target.value })}>
            {result.columns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Shelf>
        <Shelf label="Aggregate" htmlFor={`${uid}-cagg`}>
          <select className={sel} id={`${uid}-cagg`} value={current.agg ?? "none"} onChange={(e) => set({ agg: e.target.value as ChartAgg })}>
            {(Object.keys(AGG_LABEL) as ChartAgg[]).map((a) => (
              <option key={a} value={a}>
                {AGG_LABEL[a]}
              </option>
            ))}
          </select>
        </Shelf>
        <Shelf label="Color by" htmlFor={`${uid}-ccolor`}>
          <select className={sel} id={`${uid}-ccolor`} value={current.color ?? ""} onChange={(e) => set({ color: e.target.value || null })}>
            <option value="">None</option>
            {dims
              .filter((c) => c !== current.x)
              .map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
          </select>
        </Shelf>
        <Shelf label="Split into charts by" htmlFor={`${uid}-cfacet`}>
          <select className={sel} id={`${uid}-cfacet`} value={current.facet ?? ""} onChange={(e) => set({ facet: e.target.value || null })}>
            <option value="">None</option>
            {current.y.length > 1 && <option value={MEASURES}>Each measure</option>}
            {dims
              .filter((c) => c !== current.x)
              .map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
          </select>
        </Shelf>
        {stackable && (
          <Shelf label="Bars" htmlFor={`${uid}-cmode`}>
            <select className={sel} id={`${uid}-cmode`} value={current.barmode ?? "group"} onChange={(e) => set({ barmode: e.target.value as ChartSpec["barmode"] })}>
              <option value="group">{current.type === "area" ? "Stacked" : "Side by side"}</option>
              {current.type !== "area" && <option value="stack">Stacked</option>}
              <option value="percent">100% stacked</option>
            </select>
          </Shelf>
        )}
        <Shelf label="Sort" htmlFor={`${uid}-csort`}>
          <select className={sel} id={`${uid}-csort`} value={current.sort ?? "none"} onChange={(e) => set({ sort: e.target.value as ChartSpec["sort"] })}>
            <option value="none">Data order</option>
            <option value="desc">Largest first</option>
            <option value="asc">Smallest first</option>
          </select>
        </Shelf>
      </div>
      <fieldset className="min-w-0">
        <legend className="label !mb-1 text-[13px]">Measures (numbers)</legend>
        {nums.length === 0 ? (
          <p className="hint">No numeric columns in this result.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {nums.map((c) => {
              const on = current.y.includes(c);
              return (
                <label
                  key={c}
                  className={`flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-[13.5px] ${on ? "border-accent bg-accent/10" : "border-line bg-surface"}`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-(--accent)"
                    checked={on}
                    onChange={(e) => set({ y: e.target.checked ? [...current.y, c] : current.y.filter((y) => y !== c) })}
                  />
                  {c}
                </label>
              );
            })}
          </div>
        )}
      </fieldset>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="label !mb-0 text-[13px]">Filters</span>
          <select
            className="field !min-h-9 !w-auto !py-1 text-[14px]"
            aria-label="Add a filter"
            value=""
            onChange={(e) => e.target.value && set({ filters: [...filters, { column: e.target.value, values: (distinctValues(result, e.target.value) ?? []).map((v) => v.value) }] })}
          >
            <option value="">+ Filter by…</option>
            {filterable.map((c) => {
              const many = distinctValues(result, c) === null;
              return (
                <option key={c} value={c} disabled={many}>
                  {c}
                  {many ? " (too many values)" : ""}
                </option>
              );
            })}
          </select>
        </div>
        {filters.length > 0 && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {filters.map((f, i) => (
              <FilterEditor
                key={f.column}
                result={result}
                filter={f}
                onChange={(nf) => set({ filters: filters.map((x, j) => (j === i ? nf : x)) })}
                onRemove={() => set({ filters: filters.filter((_, j) => j !== i) })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Table / chart tabs plus a CSV download for one query result. */
export function ResultView({
  result,
  name,
  spec,
  onSpecChange,
}: {
  result: QueryResult;
  name: string;
  spec: ChartSpec | null;
  onSpecChange?: (s: ChartSpec | null) => void;
}) {
  const [tab, setTab] = useState<"table" | "chart">(spec ? "chart" : "table");
  const built = useMemo(() => (spec ? buildChart(spec, result) : null), [spec, result]);
  const figure = built?.figure ?? null;
  const info = built?.info;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="tnum text-[13.5px] text-muted" role="status">
          {result.row_count.toLocaleString()} row{result.row_count === 1 ? "" : "s"}
          {result.truncated ? " (more rows exist — add filters or a GROUP BY)" : ""} · {result.elapsed_ms} ms
        </p>
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Result view" className="flex rounded-lg border border-line p-0.5">
            {(["table", "chart"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                type="button"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`min-h-9 rounded-md px-3 text-[14px] capitalize ${tab === t ? "bg-sunken font-semibold" : "text-muted"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-quiet !min-h-10 !px-3 text-[14px]" onClick={() => downloadCsv(result, name)}>
            CSV
          </button>
        </div>
      </div>
      <div className="mt-3">
        {tab === "table" ? (
          <ResultTable result={result} />
        ) : (
          <div className="space-y-4">
            {onSpecChange && <ChartPicker result={result} spec={spec} onChange={onSpecChange} />}
            {info && (info.folded > 0 || info.hiddenPanels > 0 || info.measuresDropped > 0 || info.rows === 0) && (
              <p className="hint" role="status">
                {info.rows === 0 && "No rows left after the filters. "}
                {info.folded > 0 &&
                  `${info.colorValues} colour values: the ${info.colorValues - info.folded} largest have their own colour, the other ${info.folded} are grouped as “Other”. Add a filter or use small multiples to see them all. `}
                {info.hiddenPanels > 0 && `${info.hiddenPanels} more small charts not shown; add a filter. `}
                {info.measuresDropped > 0 && "With Color and small multiples by a column, only the first measure is drawn."}
              </p>
            )}
            {figure ? (
              <PlotlyChart figure={figure} title={name} />
            ) : (
              <p className="text-muted">Choose at least one numeric column for the Y axis.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
