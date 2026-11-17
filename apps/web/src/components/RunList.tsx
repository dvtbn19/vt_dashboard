import Link from "next/link";
import { StatusDot } from "./Status";
import { ago, duration } from "@/lib/format";
import type { RunListItem } from "@/lib/types";

export function RunList({ runs, projectNames }: { runs: RunListItem[]; projectNames?: Record<string, string> }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {runs.map((r) => (
        <li key={r.id}>
          <Link
            href={`/lab/runs/${r.id}`}
            className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-1 py-3.5 hover:bg-sunken md:grid-cols-[minmax(0,1fr)_120px_120px_110px]"
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold">{r.name}</span>
              <span className="block truncate text-[13.5px] text-muted">
                {projectNames?.[r.project_id] ? `${projectNames[r.project_id]} · ` : ""}
                {r.created_by ?? r.source}
              </span>
            </span>
            <span className="justify-self-end md:justify-self-start">
              <StatusDot status={r.status} />
            </span>
            <span className="tnum col-span-2 text-[13.5px] text-muted md:col-span-1">
              {r.metric_count} metrics · {r.artifact_count} files
            </span>
            <span className="tnum hidden text-right text-[13.5px] text-muted md:block" title={r.started_at}>
              {ago(r.started_at)}
              <span className="block">{duration(r.started_at, r.finished_at)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
