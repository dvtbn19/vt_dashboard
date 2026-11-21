import Link from "next/link";
import { NoteForm } from "@/components/NoteForm";
import { ProblemState } from "@/components/ProblemState";
import { api } from "@/lib/api";
import { attempt } from "@/lib/attempt";
import type { Note, Project, SavedQueryListItem } from "@/lib/types";

export const metadata = { title: "Note" };

export default async function NotePage({ params }: { params: Promise<{ id: string; noteId: string }> }) {
  const { id, noteId } = await params;
  const res = await attempt(() =>
    Promise.all([
      api<Project>(`/v1/projects/${id}`),
      api<Note>(`/v1/notes/${noteId}`),
      api<SavedQueryListItem[]>(`/v1/projects/${id}/queries`),
    ]),
  );
  if (!res.ok) return <ProblemState problem={res.problem} />;
  const [project, note, queries] = res.data;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/lab/projects/${project.id}`} className="text-[14px] text-muted hover:text-ink">
          {project.name}
        </Link>
        <Link href={`/lab/projects/${project.id}/workspace?note=${note.id}`} className="btn btn-quiet !min-h-9 !px-3 text-[14px]">
          Open beside SQL
        </Link>
      </div>
      <div className="mt-2 max-w-[820px]">
        <NoteForm key={`${note.id}:${note.version}`} note={note} queries={queries} />
      </div>
    </>
  );
}
