import Link from "next/link";
import { Presentation } from "@/components/Presentation";
import { ProblemState } from "@/components/ProblemState";
import { attempt } from "@/lib/attempt";
import { loadPresentation } from "@/lib/presentation";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ note?: string }>;
}) {
  const { id } = await params;
  const { note: noteId } = await searchParams;
  const res = await attempt(() => loadPresentation(id, noteId));
  if (!res.ok) return <ProblemState problem={res.problem} />;
  const data = res.data;
  const q = data.note ? `?note=${data.note.id}` : "";
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/lab/projects/${data.project.id}`} className="text-[14px] text-muted hover:text-ink">
          ← {data.project.name}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {data.notes.length > 1 && (
            <nav aria-label="Notes" className="flex flex-wrap gap-1 text-[13.5px]">
              {data.notes.map((n) => (
                <Link
                  key={n.id}
                  href={`?note=${n.id}`}
                  className={`rounded-full px-3 py-1.5 ${n.id === data.note?.id ? "bg-sunken font-semibold" : "text-muted hover:text-ink"}`}
                >
                  {n.title}
                </Link>
              ))}
            </nav>
          )}
          <Link href={`/lab/projects/${data.project.id}/workspace${q}`} className="btn btn-quiet !min-h-10 !px-3 text-[14px]">
            Edit in workspace
          </Link>
          <Link href={`/lab/present/${data.project.id}${q}`} className="btn !min-h-10 !px-4 text-[14px]">
            Present
          </Link>
        </div>
      </div>
      <Presentation data={data} mode="app" />
    </>
  );
}
