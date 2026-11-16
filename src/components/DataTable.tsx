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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-2.5">
        <span className="text-[13px] tabular-nums text-pencil">
          {view.length.toLocaleString()} rows, {columns.length} columns
        </span>
        <label className="flex items-center gap-2 text-[13px] text-pencil">
          <span className="sr-only">Filter rows</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter rows"
            className="field !min-h-[36px] w-44 !py-1.5 !text-[14px]"
          />
        </label>
      </div>
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full border-collapse text-[14px]">
          <thead className="sticky top-0 bg-sheet">
            <tr>
              {columns.map((c, i) => (
                <th
                  key={i}
                  scope="col"
                  aria-sort={sort?.col === i ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                  className={`border-b border-ink whitespace-nowrap px-3 py-2 font-semibold ${numeric[i] ? "text-right" : "text-left"}`}
                >
                  <button
                    type="button"
                    onClick={() => setSort((s) => (s?.col === i ? (s.dir === 1 ? { col: i, dir: -1 } : null) : { col: i, dir: 1 }))}
                    className="hover:text-signal"
                  >
                    {c}
                    <span aria-hidden className="ml-1 text-pencil">
                      {sort?.col === i ? (sort.dir === 1 ? "▲" : "▼") : ""}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.slice(0, limit).map((r, ri) => (
              <tr key={ri} className="hover:bg-[color-mix(in_srgb,var(--signal)_6%,transparent)]">
                {r.map((c, ci) => (
                  <td
                    key={ci}
                    className={`whitespace-nowrap border-b border-rule px-3 py-1.5 ${numeric[ci] ? "text-right tabular-nums" : ""} ${
                      c === null ? "text-pencil" : ""
                    }`}
                  >
                    {c === null ? "—" : typeof c === "number" && !Number.isInteger(c) ? +c.toFixed(4) : String(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {view.length > limit ? (
        <button type="button" onClick={() => setLimit((l) => l + 200)} className="w-full border-t border-rule py-2.5 text-[14px] font-medium text-signal hover:underline">
          Show {Math.min(200, view.length - limit)} more rows
        </button>
      ) : null}
    </div>
  );
}
