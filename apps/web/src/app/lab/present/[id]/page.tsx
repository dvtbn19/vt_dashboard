import type { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { Presentation } from "@/components/Presentation";
import { ProblemState } from "@/components/ProblemState";
import { ThemeToggle } from "@/components/ThemeToggle";
import { attempt } from "@/lib/attempt";
import { loadPresentation } from "@/lib/presentation";

export const metadata: Metadata = { title: "Presentation", robots: { index: false } };

/** Full-screen stakeholder view: no lab navigation, print-friendly. */
export default async function PresentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ note?: string }>;
}) {
  const { id } = await params;
  const { note: noteId } = await searchParams;
  const res = await attempt(() => loadPresentation(id, noteId));
  if (!res.ok)
    return (
      <main className="wrap">
        <ProblemState problem={res.problem} />
      </main>
    );
  const data = res.data;
  return (
    <div className="min-h-dvh">
      <div className="no-print sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-[1120px] items-center justify-between px-4">
          <Link href={`/lab/projects/${data.project.id}/dashboard${data.note ? `?note=${data.note.id}` : ""}`} className="text-[14px] text-muted hover:text-ink">
            ← Exit presentation
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <PrintButton />
          </div>
        </div>
      </div>
      <main className="px-4 pb-16 pt-6 md:px-8 md:pt-10">
        <Presentation data={data} mode="present" />
      </main>
    </div>
  );
}
