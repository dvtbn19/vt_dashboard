import Link from "next/link";
import { updateProject } from "../../../../actions";
import { ProblemState } from "@/components/ProblemState";
import { ProjectForm } from "@/components/ProjectForm";
import { api } from "@/lib/api";
import { attempt } from "@/lib/attempt";
import type { Project } from "@/lib/types";

export const metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await attempt(() => api<Project>(`/v1/projects/${id}`));
  if (!res.ok) return <ProblemState problem={res.problem} />;
  const project = res.data;
  return (
    <div className="max-w-[720px]">
      <Link href={`/lab/projects/${id}`} className="text-[14px] text-muted hover:text-ink">
        {project.name}
      </Link>
      <h1 className="mb-8 mt-2 text-[28px] font-bold tracking-tight">Edit project</h1>
      <ProjectForm action={updateProject.bind(null, id)} project={project} />
    </div>
  );
}
