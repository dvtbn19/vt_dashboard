import Link from "next/link";
import { ProblemState } from "@/components/ProblemState";
import { QueryEditor } from "@/components/QueryEditor";
import { api } from "@/lib/api";
import { attempt } from "@/lib/attempt";
import type { Project, QueryEngine, SavedQuery } from "@/lib/types";

export const metadata = { title: "Query" };

export default async function QueryPage({ params }: { params: Promise<{ id: string; queryId: string }> }) {
  const { id, queryId } = await params;
  const res = await attempt(() =>
    Promise.all([
      api<Project>(`/v1/projects/${id}`),
      api<SavedQuery>(`/v1/queries/${queryId}`),
      api<QueryEngine>("/v1/queries/engine"),
    ]),
  );
  if (!res.ok) return <ProblemState problem={res.problem} />;
  const [project, query, engine] = res.data;
  return (
    <>
      <Link href={`/lab/projects/${project.id}`} className="text-[14px] text-muted hover:text-ink">
        {project.name}
      </Link>
      <div className="mt-2">
        <QueryEditor key={`${query.id}:${query.version}`} projectId={project.id} query={query} engine={engine} />
      </div>
    </>
  );
}
