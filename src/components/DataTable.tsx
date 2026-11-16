"use client";

import { useMemo, useState } from "react";

type Cell = string | number | null;

export function DataTable({ columns, rows }: { columns: string[]; rows: Cell[][] }) {
  const [sort, setSort] = useState<{ col: number; dir: 1 | -1 } | null>(null);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(50);

  const numeric = useMemo(
    () => columns.map((_, i) => rows.length > 0 && rows.every((r) => r[i] === null || typeof r[i] === "number")),
    [columns, rows],
  );

  const view = useMemo(() => {
    let out = rows;
    if (q) {
      const needle = q.toLowerCase();
      out = out.filter((r) => r.some((c) => c !== null && String(c).toLowerCase().includes(needle)));
    }
    if (sort) {
      const { col, dir } = sort;
      out = [...out].sort((a, b) => {
        const x = a[col];
        const y = b[col];
        if (x === y) return 0;
        if (x === null) return 1;
        if (y === null) return -1;
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
      });
    }
    return out;
  }, [rows, q, sort]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
        <span className="label">
          {view.length.toLocaleString()} × {columns.length}
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="filter…"
          className="w-36 rounded-md border border-line-2 bg-ink-2 px-2 py-1 font-mono text-xs outline-none focus:border-lime"
        />
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full border-collapse font-mono text-[12.5px]">
          <thead className="sticky top-0 bg-panel">
            <tr>
              {columns.map((c, i) => (
                <th
                  key={i}
                  onClick={() => setSort((s) => (s?.col === i ? (s.dir === 1 ? { col: i, dir: -1 } : null) : { col: i, dir: 1 }))}
                  className={`cursor-pointer select-none whitespace-nowrap border-b border-line px-3 py-2 font-medium text-muted hover:text-fg ${
                    numeric[i] ? "text-right" : "text-left"
                  }`}
                >
                  {c}
                  {sort?.col === i ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.slice(0, limit).map((r, ri) => (
              <tr key={ri} className="odd:bg-white/[0.015] hover:bg-white/[0.04]">
                {r.map((c, ci) => (
                  <td
                    key={ci}
                    className={`whitespace-nowrap border-b border-line/60 px-3 py-1.5 ${numeric[ci] ? "text-right tabular-nums" : ""} ${
                      c === null ? "text-dim" : ""
                    }`}
                  >
                    {c === null ? "null" : typeof c === "number" && !Number.isInteger(c) ? +c.toFixed(4) : String(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {view.length > limit ? (
        <button type="button" onClick={() => setLimit((l) => l + 200)} className="label w-full border-t border-line py-2 hover:text-fg">
          show more ({view.length - limit} hidden)
        </button>
      ) : null}
    </div>
  );
}
