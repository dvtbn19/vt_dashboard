import type { Cell, QueryResult } from "./types";

export { defaultChart, figureFor, numericColumns, usableChart } from "./chart";

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
