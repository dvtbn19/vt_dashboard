import type { Cell, ChartSpec, QueryResult } from "./types";

/** Columns whose non-null values are all numbers (candidates for a chart's y axis). */
export function numericColumns(r: QueryResult): string[] {
  return r.columns.filter((_, i) => {
    let seen = false;
    for (const row of r.rows) {
      const v = row[i];
      if (v === null) continue;
      if (typeof v !== "number") return false;
      seen = true;
    }
    return seen;
  });
}

/** A reasonable first chart: first non-numeric column on x, up to three numeric columns on y. */
export function defaultChart(r: QueryResult): ChartSpec | null {
  const nums = numericColumns(r);
  if (!nums.length || !r.columns.length) return null;
  const x = r.columns.find((c) => !nums.includes(c)) ?? r.columns[0];
  const y = nums.filter((c) => c !== x).slice(0, 3);
  return y.length ? { type: "bar", x, y } : null;
}

/** Keep a saved chart only if its columns still exist in the result. */
export function usableChart(spec: ChartSpec | null, r: QueryResult): ChartSpec | null {
  if (!spec || !r.columns.includes(spec.x)) return null;
  const y = spec.y.filter((c) => r.columns.includes(c));
  return y.length ? { ...spec, y } : null;
}

export function figureFor(spec: ChartSpec, r: QueryResult) {
  const xi = r.columns.indexOf(spec.x);
  const xs = r.rows.map((row) => row[xi]);
  const data = spec.y.map((col) => {
    const yi = r.columns.indexOf(col);
    const ys = r.rows.map((row) => row[yi]);
    if (spec.type === "bar") return { type: "bar", name: col, x: xs, y: ys };
    return { type: "scatter", mode: spec.type === "line" ? "lines+markers" : "markers", name: col, x: xs, y: ys };
  });
  return {
    data,
    layout: {
      barmode: "group",
      showlegend: spec.y.length > 1,
      legend: { orientation: "h", y: -0.2 },
      margin: { t: 16 },
      xaxis: { automargin: true, type: typeof xs[0] === "number" ? "linear" : "category" },
      yaxis: { automargin: true },
    },
  };
}

function csvCell(v: Cell): string {
  if (v === null) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(r: QueryResult): string {
  return [r.columns.map(csvCell).join(","), ...r.rows.map((row) => row.map(csvCell).join(","))].join("\r\n");
}

export function downloadCsv(r: QueryResult, name: string) {
  const blob = new Blob(["﻿" + toCsv(r)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^\w.-]+/g, "_").slice(0, 80) || "query"}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
export function formatCell(v: Cell): string {
  if (v === null) return "NULL";
  if (typeof v === "number") return Number.isInteger(v) && Math.abs(v) < 1e15 ? String(v) : nf.format(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
