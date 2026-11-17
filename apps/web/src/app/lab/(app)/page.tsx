import Link from "next/link";
import { ProblemState } from "@/components/ProblemState";
import { RunList } from "@/components/RunList";
import { api } from "@/lib/api";
import { attempt } from "@/lib/attempt";
import type { Overview } from "@/lib/types";

export const metadata = { title: "Overview" };

function Readout({ label, value, tone }: { label: string; value: number; tone?: "run" | "fail" }) {
  const color = tone === "run" && value > 0 ? "text-run" : tone === "fail" && value > 0 ? "text-fail" : "text-ink";
  return (
    <div className="px-4 py-3">
      <dt className="text-[13.5px] text-muted">{label}</dt>
      <dd className={`tnum text-[28px] font-bold leading-tight ${color}`}>{value.toLocaleString("en-AU")}</dd>
    </div>
  );
}

function FirstSteps() {
  return (
    <section className="sheet mt-8 p-5 md:p-7">
      <h2 className="text-[19px] font-bold">Publish your first results</h2>
      <ol className="mt-4 list-decimal space-y-3 pl-5 text-muted marker:font-semibold marker:text-ink">
        <li>
          <Link href="/lab/projects/new" className="link">
            Create a project
          </Link>{" "}
          — for example “E-Commerce Sales Analysis” with the slug <code className="font-mono text-ink">ecommerce-sales-analysis</code>.
        </li>
        <li>
          <Link href="/lab/settings" className="link">
            Create an agent token
          </Link>{" "}
          scoped to that project.
        </li>
        <li>
          Run the example from the repository:
          <pre className="mt-2 overflow-x-auto rounded-lg bg-sunken p-3 font-mono text-[13px] text-ink">
            {`export VTCONS_LAB_URL=http://127.0.0.1:8000
export VTCONS_LAB_TOKEN=vtl_...
python workflows/examples/ecommerce_eda/run_eda.py`}
          </pre>
        </li>
      </ol>
    </section>
  );
}

export default async function OverviewPage() {
  const res = await attempt(() => api<Overview>("/v1/overview"));
  if (!res.ok) return <ProblemState problem={res.problem} />;
  const o = res.data;
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Overview</h1>
          <p className="text-muted">What ran recently, what is still running, and what failed.</p>
        </div>
        <Link href="/lab/projects/new" className="btn">
          New project
        </Link>
      </div>

      <dl className="sheet mt-6 grid grid-cols-2 divide-line sm:grid-cols-3 lg:grid-cols-5 [&>div]:border-line max-sm:[&>div:nth-child(odd)]:border-r sm:[&>div:not(:last-child)]:border-r">
        <Readout label="Projects" value={o.project_count} />
        <Readout label="Runs" value={o.run_count} />
        <Readout label="Running" value={o.running_count} tone="run" />
        <Readout label="Failed" value={o.failed_count} tone="fail" />
        <Readout label="Files" value={o.artifact_count} />
      </dl>

      {o.project_count === 0 ? (
        <FirstSteps />
      ) : (
        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[19px] font-bold">Recent runs</h2>
            <Link href="/lab/projects" className="text-[14px] text-muted hover:text-ink">
              All projects
            </Link>
          </div>
          {o.recent_runs.length === 0 ? (
            <p className="text-muted">No runs yet. Publish one with the SDK; it will appear here.</p>
          ) : (
            <RunList runs={o.recent_runs} projectNames={o.project_names} />
          )}
        </section>
      )}
    </>
  );
}
