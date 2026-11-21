"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PlotlyChart } from "./PlotlyChart";
import { ResultTable } from "./ResultView";
import { runSavedQuery } from "@/app/lab/workspace-actions";
import { downloadCsv, figureFor, usableChart } from "@/lib/queryResult";
import type { QueryResult, SavedQuery } from "@/lib/types";

/** A numbered exhibit for stakeholders: the saved query's chart (or table), run live, with its data on demand. */
export function EvidenceFigure({
  query,
  number,
  editHref,
}: {
  query: Pick<SavedQuery, "id" | "name" | "description" | "chart">;
  number: number;
  editHref?: string;
}) {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showData, setShowData] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await runSavedQuery(query.id);
    if (res.ok) setResult(res.result);
    else setError(res.error);
  }, [query.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    void load();
  }, [load]);

  const spec = result ? usableChart(query.chart, result) : null;
  const figure = useMemo(() => (spec && result ? figureFor(spec, result) : null), [spec, result]);

  return (
    <figure id={`fig-${number}`} className="sheet min-w-0 break-inside-avoid scroll-mt-20 p-4 md:p-5">
      <figcaption className="mb-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">Exhibit {number}</p>
        <p className="mt-0.5 text-[16.5px] font-bold leading-snug">{query.name}</p>
        {query.description && <p className="mt-1 text-[14px] text-muted">{query.description}</p>}
      </figcaption>
      {error ? (
        <p role="alert" className="rounded-lg bg-fail/8 px-3 py-2 text-[14px] text-fail">
          Could not load: {error}
        </p>
      ) : !result ? (
        <div className="h-[320px] animate-pulse rounded-lg bg-sunken" aria-label="Loading" />
      ) : figure && !showData ? (
        <PlotlyChart figure={figure} title={query.name} />
      ) : (
        <ResultTable result={result} />
      )}
      {result && (
        <div className="no-print mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
          <span className="tnum">
            {result.row_count.toLocaleString()} rows{result.truncated ? "+" : ""} · live
          </span>
          {figure && (
            <button type="button" className="underline hover:text-ink" onClick={() => setShowData((v) => !v)}>
              {showData ? "Show chart" : "Show data"}
            </button>
          )}
          <button type="button" className="underline hover:text-ink" onClick={() => downloadCsv(result, query.name)}>
            CSV
          </button>
          {editHref && (
            <a className="underline hover:text-ink" href={editHref}>
              SQL
            </a>
          )}
        </div>
      )}
    </figure>
  );
}
