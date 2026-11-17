import Link from "next/link";
import { ProblemState } from "@/components/ProblemState";
import { Chip, StatusDot } from "@/components/Status";
import { api } from "@/lib/api";
import { attempt } from "@/lib/attempt";
import { ago } from "@/lib/format";
import { categoryLabel, type ProjectListItem } from "@/lib/types";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const res = await attempt(() => api<ProjectListItem[]>("/v1/projects"));
  if (!res.ok) return <ProblemState problem={res.problem} />;
  const projects = res.data;
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Projects</h1>
          <p className="text-muted">{projects.length === 1 ? "1 project" : `${projects.length} projects`}, most recently active first.</p>
        </div>
        <Link href="/lab/projects/new" className="btn">
          New project
        </Link>
      </div>
      {projects.length === 0 ? (
        <div className="sheet mt-8 p-6">
          <h2 className="font-bold">No projects yet</h2>
          <p className="mt-1 text-muted">A project groups the runs, metrics and files your scripts publish. Create one to get a slug your scripts can use.</p>
          <Link href="/lab/projects/new" className="btn mt-4">
            Create a project
          </Link>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/lab/projects/${p.id}`} className="grid gap-2 px-1 py-4 hover:bg-sunken md:grid-cols-[minmax(0,1fr)_150px_170px] md:items-center md:gap-6">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{p.name}</span>
                    {p.visibility === "public" && <Chip tone="accent">Public</Chip>}
                    {p.status !== "active" && <Chip>{p.status}</Chip>}
                  </span>
                  <span className="mt-0.5 block truncate text-[14px] text-muted">{p.summary || p.slug}</span>
                </span>
                <span className="text-[14px] text-muted">{categoryLabel(p.category)}</span>
                <span className="flex items-center gap-3 text-[14px] text-muted md:justify-end">
                  {p.last_run_status ? <StatusDot status={p.last_run_status} withLabel={false} /> : null}
                  <span className="tnum">
                    {p.run_count} {p.run_count === 1 ? "run" : "runs"} · {p.last_run_at ? ago(p.last_run_at) : "none yet"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
