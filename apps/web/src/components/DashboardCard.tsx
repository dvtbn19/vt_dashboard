"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ResultView } from "./ResultView";
import { runSavedQuery } from "@/app/lab/workspace-actions";
import { usableChart } from "@/lib/queryResult";
import type { QueryResult, SavedQuery } from "@/lib/types";

/** One saved query with a chart, run live when the dashboard opens. */
export function DashboardCard({ query, projectId }: { query: SavedQuery; projectId: string }) {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await runSavedQuery(query.id);
    setLoading(false);
    if (res.ok) setResult(res.result);
    else setError(res.error);
  }, [query.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    void load();
  }, [load]);

  const spec = result ? usableChart(query.chart, result) : null;
  return (
    <article className="sheet min-w-0 p-4 md:p-5">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[16.5px] font-bold">{query.name}</h2>
          {query.description && <p className="mt-0.5 line-clamp-2 text-[13.5px] text-muted">{query.description}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" className="min-h-9 rounded-lg px-2.5 text-[13.5px] text-muted hover:bg-sunken hover:text-ink" onClick={() => void load()} disabled={loading}>
            {loading ? "Running…" : "Refresh"}
          </button>
          <Link href={`/lab/projects/${projectId}/queries/${query.id}`} className="min-h-9 rounded-lg px-2.5 py-2 text-[13.5px] text-muted hover:bg-sunken hover:text-ink">
            Edit
          </Link>
        </div>
      </header>
      {error ? (
        <p role="alert" className="rounded-lg bg-fail/8 px-3 py-2 text-[14px] text-fail">
          {error}
        </p>
      ) : !result ? (
        <div className="h-[380px] animate-pulse rounded-lg bg-sunken" aria-label="Loading" />
      ) : (
        <ResultView result={result} name={query.name} spec={spec} />
      )}
    </article>
  );
}
