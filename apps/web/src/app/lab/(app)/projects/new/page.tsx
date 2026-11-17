import Link from "next/link";
import { createProject } from "../../../actions";
import { ProjectForm } from "@/components/ProjectForm";

export const metadata = { title: "New project" };

export default function NewProjectPage() {
  return (
    <div className="max-w-[720px]">
      <Link href="/lab/projects" className="text-[14px] text-muted hover:text-ink">
        Projects
      </Link>
      <h1 className="mt-2 text-[28px] font-bold tracking-tight">New project</h1>
      <p className="mb-8 text-muted">New projects are private until you choose to publish them.</p>
      <ProjectForm action={createProject} />
    </div>
  );
}
