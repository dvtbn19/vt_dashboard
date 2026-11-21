import Link from "next/link";
import { NoteEditor } from "@/components/NoteEditor";
import { ProblemState } from "@/components/ProblemState";
import { api } from "@/lib/api";
import { attempt } from "@/lib/attempt";
import type { Note, Project } from "@/lib/types";

export const metadata = { title: "Note" };

export default async function NotePage({ params }: { params: Promise<{ id: string; noteId: string }> }) {
  const { id, noteId } = await params;
  const res = await attempt(() => Promise.all([api<Project>(`/v1/projects/${id}`), api<Note>(`/v1/notes/${noteId}`)]));
  if (!res.ok) return <ProblemState problem={res.problem} />;
  const [project, note] = res.data;
  return (
    <>
      <Link href={`/lab/projects/${project.id}`} className="text-[14px] text-muted hover:text-ink">
        {project.name}
      </Link>
      <div className="mt-2">
        <NoteEditor key={`${note.id}:${note.version}`} note={note} />
      </div>
    </>
  );
}
