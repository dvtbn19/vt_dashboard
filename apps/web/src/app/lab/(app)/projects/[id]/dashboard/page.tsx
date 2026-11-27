import Link from "next/link";
import { DashboardSource } from "@/components/DashboardSource";
import { Presentation } from "@/components/Presentation";
import { ProblemState } from "@/components/ProblemState";
import { RunDashboard } from "@/components/RunDashboard";
import { attempt } from "@/lib/attempt";
import { loadPresentation } from "@/lib/presentation";
import { loadRunDashboard } from "@/lib/runDashboard";

export const metadata = { title: "Dashboard" };

function ViewTabs({ base, view, note }: { base: string; view: "run" | "notes"; note?: string }) {
  const tab = (active: boolean) => `rounded-full px-3 py-1.5 ${active ? "bg-sunken font-semibold text-ink" : "text-muted hover:text-ink"}`;
  return (
    <nav aria-label="Dashboard view" className="flex gap-1 text-[14px]">
      <Link href={base} className={tab(view === "run")} aria-current={view === "run" ? "page" : undefined}>
        Run charts
      </Link>
      <Link href={`${base}?view=notes${note ? `&note=${note}` : ""}`} className={tab(view === "notes")} aria-current={view === "notes" ? "page" : undefined}>
        Notes summary
      </Link>
    </nav>
  );
}

/**
 * The project's dashboard. By default it shows a run's published story and charts (the pinned run,
 * else the latest completed run with a chart); `?view=notes` shows the summary built from the
 * working notes and saved queries.
 */
export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ note?: string; view?: string; run?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const base = `/lab/projects/${id}/dashboard`;

  if (sp.view !== "notes") {
    const res = await attempt(() => loadRunDashboard(id, sp.run));
    if (!res.ok) return <ProblemState problem={res.problem} />;
    const data = res.data;
    if (data.run) {
      const options = data.runs.some((r) => r.id === data.run!.id) ? data.runs : [data.run, ...data.runs];
      return (
        <>
          <div className="mx-auto mb-5 flex max-w-[1320px] flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/lab/projects/${id}`} className="text-[14px] text-muted hover:text-ink">
                ← {data.run.project.name}
              </Link>
              <ViewTabs base={base} view="run" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DashboardSource projectId={id} runs={options} current={data.run.id} pinned={data.pinned} pinSupported={data.pinSupported} />
              <Link href={`/lab/projects/${id}/workspace`} className="btn btn-quiet !min-h-10 !px-3 text-[14px]">
                Workspace
              </Link>
            </div>
          </div>
          <RunDashboard data={data} />
        </>
      );
    }
    // No run with charts yet: fall through to the notes summary.
  }

  const res = await attempt(() => loadPresentation(id, sp.note));
  if (!res.ok) return <ProblemState problem={res.problem} />;
  const data = res.data;
  const q = data.note ? `?note=${data.note.id}` : "";
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/lab/projects/${data.project.id}`} className="text-[14px] text-muted hover:text-ink">
            ← {data.project.name}
          </Link>
          <ViewTabs base={base} view="notes" note={data.note?.id} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.notes.length > 1 && (
            <nav aria-label="Notes" className="flex flex-wrap gap-1 text-[13.5px]">
              {data.notes.map((n) => (
                <Link
                  key={n.id}
                  href={`?view=notes&note=${n.id}`}
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
