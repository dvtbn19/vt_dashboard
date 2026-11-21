"use client";

import { useMemo, useState } from "react";
import { PlotlyChart } from "./PlotlyChart";
import { downloadCsv, figureFor, formatCell, numericColumns } from "@/lib/queryResult";
import type { ChartSpec, ChartType, QueryResult } from "@/lib/types";

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

export function ChartPicker({
  result,
  spec,
  onChange,
}: {
  result: QueryResult;
  spec: ChartSpec | null;
  onChange: (s: ChartSpec | null) => void;
}) {
  const nums = numericColumns(result);
  const current = spec ?? { type: "bar" as ChartType, x: result.columns[0], y: [] };
  const set = (patch: Partial<ChartSpec>) => {
    const next = { ...current, ...patch };
    onChange(next.y.length ? next : null);
  };
  return (
    <div className="flex flex-wrap items-end gap-4 text-[14px]">
      <div>
        <label className="label" htmlFor="ctype">
          Chart
        </label>
        <select className="field !min-h-10 !py-1.5" id="ctype" value={current.type} onChange={(e) => set({ type: e.target.value as ChartType })}>
          <option value="bar">Bar</option>
          <option value="line">Line</option>
          <option value="scatter">Scatter</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="cx">
          X axis
        </label>
        <select className="field !min-h-10 !py-1.5" id="cx" value={current.x} onChange={(e) => set({ x: e.target.value })}>
          {result.columns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="min-w-0">
        <legend className="label">Y axis (numbers)</legend>
        {nums.length === 0 ? (
          <p className="hint">No numeric columns in this result.</p>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {nums.map((c) => (
              <label key={c} className="flex min-h-9 items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-(--accent)"
                  checked={current.y.includes(c)}
                  onChange={(e) => set({ y: e.target.checked ? [...current.y, c] : current.y.filter((y) => y !== c) })}
                />
                {c}
              </label>
            ))}
          </div>
        )}
      </fieldset>
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
  const figure = useMemo(() => (spec ? figureFor(spec, result) : null), [spec, result]);
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
