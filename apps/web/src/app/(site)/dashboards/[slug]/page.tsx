import { notFound } from "next/navigation";
import { RunDashboard } from "@/components/RunDashboard";
import { getPublicDashboard } from "@/lib/public";
import type { LoadedPreview } from "@/lib/runDashboard";
import type { Project, RunDetail } from "@/lib/types";

// Rendered per request; the API response itself is cached for a minute (see lib/public.ts).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const d = await getPublicDashboard((await params).slug).catch(() => null);
  return { title: d ? `${d.project.name} · dashboard` : "Dashboard" };
}

/** A dashboard its owner published from the Lab: read-only, no sign-in, no file downloads. */
export default async function PublicDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const d = await getPublicDashboard((await params).slug);
  if (!d) notFound();
  // RunDashboard renders a lab run; give it the public fields and nothing else.
  const run = {
    ...d.run,
    id: "",
    project_id: "",
    source: "",
    git_commit: null,
    dataset_version: null,
    notes: null,
    error: null,
    created_at: d.run.started_at,
    created_by: null,
    project: { name: d.project.name, slug: d.project.slug, category: d.project.category } as Project,
    metrics: d.metrics,
    artifacts: d.artifacts.map((a) => ({
      id: a.id,
      run_id: "",
      name: a.name,
      kind: a.kind,
      mime_type: "",
      size_bytes: 0,
      checksum_sha256: null,
      status: "ready" as const,
      description: a.description,
      failure_reason: null,
      created_at: d.run.started_at,
      finalized_at: null,
    })),
  } satisfies RunDetail;
  const previews: Record<string, LoadedPreview> = {};
  for (const a of d.artifacts) previews[a.id] = a.preview ? { ok: true, preview: a.preview } : { ok: false, error: a.error ?? "Preview unavailable" };
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-10 pt-8 md:px-8">
      <RunDashboard data={{ run, previews }} mode="public" />
    </div>
  );
}
