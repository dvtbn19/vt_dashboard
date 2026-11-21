import Link from "next/link";
import { DashboardCard } from "@/components/DashboardCard";
import { ProblemState } from "@/components/ProblemState";
import { api } from "@/lib/api";
import { attempt } from "@/lib/attempt";
import type { Project, QueryEngine, SavedQuery } from "@/lib/types";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await attempt(async () => {
    const [project, list, engine] = await Promise.all([
      api<Project>(`/v1/projects/${id}`),
      api<SavedQuery[]>(`/v1/projects/${id}/queries`),
      api<QueryEngine>("/v1/queries/engine"),
    ]);
    return { project, engine, charted: list.filter((q) => q.chart) };
  });
  if (!res.ok) return <ProblemState problem={res.problem} />;
  const { project, engine, charted } = res.data;
  return (
    <>
      <Link href={`/lab/projects/${project.id}`} className="text-[14px] text-muted hover:text-ink">
        {project.name}
      </Link>
      <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-tight">Dashboard</h1>
      <p className="mt-1 max-w-[70ch] text-muted">
        Every saved query with a chart, run live against the analytics database each time you open this page.
      </p>
      {!engine.configured ? (
        <div className="sheet mt-6 p-5">
          <p className="font-semibold">Running SQL is not set up yet</p>
          <p className="mt-1 text-[15px] text-muted">
            Set <code className="font-mono">ANALYTICS_DATABASE_URL</code> on the API to a read-only database user, then reload.
          </p>
        </div>
      ) : charted.length === 0 ? (
        <div className="sheet mt-6 p-5">
          <p className="font-semibold">No charts yet</p>
          <p className="mt-1 text-[15px] text-muted">
            Open a saved query, run it, pick a chart in the Chart tab and save. It will appear here.
          </p>
          <Link href={`/lab/projects/${project.id}/queries/new`} className="btn mt-4">
            New query
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          {charted.map((q) => (
            <DashboardCard key={q.id} query={q} projectId={project.id} />
          ))}
        </div>
      )}
    </>
  );
}
