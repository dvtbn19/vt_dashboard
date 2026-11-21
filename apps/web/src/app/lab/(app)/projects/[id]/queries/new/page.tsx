import Link from "next/link";
import { ProblemState } from "@/components/ProblemState";
import { QueryEditor } from "@/components/QueryEditor";
import { api } from "@/lib/api";
import { attempt } from "@/lib/attempt";
import type { Project, QueryEngine } from "@/lib/types";

export const metadata = { title: "New query" };

export default async function NewQueryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await attempt(() => Promise.all([api<Project>(`/v1/projects/${id}`), api<QueryEngine>("/v1/queries/engine")]));
  if (!res.ok) return <ProblemState problem={res.problem} />;
  const [project, engine] = res.data;
  return (
    <>
      <Link href={`/lab/projects/${project.id}`} className="text-[14px] text-muted hover:text-ink">
        {project.name}
      </Link>
      <div className="mt-2">
        <QueryEditor projectId={project.id} query={null} engine={engine} />
      </div>
    </>
  );
}
