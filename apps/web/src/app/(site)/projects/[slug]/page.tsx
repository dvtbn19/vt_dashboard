import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { getPublicProject } from "@/lib/public";
import { categoryLabel } from "@/lib/types";
import { fmtDate } from "@/lib/format";

// Rendered per request; the API response itself is cached for 5 minutes (see lib/public.ts).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const p = await getPublicProject((await params).slug).catch(() => null);
  return { title: p?.name ?? "Project" };
}

export default async function PublicProject({ params }: { params: Promise<{ slug: string }> }) {
  const p = await getPublicProject((await params).slug);
  if (!p) notFound();
  return (
    <article className="wrap max-w-[820px] pb-8 pt-12">
      <Link href="/projects" className="text-[14px] text-muted hover:text-ink">
        All projects
      </Link>
      <p className="mt-6 text-[14px] text-muted">
        {categoryLabel(p.category)} · updated {fmtDate(p.updated_at)}
      </p>
      <h1 className="mt-1 text-[34px] font-bold leading-tight tracking-tight">{p.name}</h1>
      {p.summary && <p className="mt-3 text-[18px] text-muted">{p.summary}</p>}
      {p.tags.length > 0 && <p className="mt-3 text-[14px] text-muted">{p.tags.join(", ")}</p>}
      {p.repo_url && (
        <p className="mt-4">
          <a className="link" href={p.repo_url} rel="noopener noreferrer" target="_blank">
            Source repository
          </a>
        </p>
      )}
      <div className="mt-10 border-t border-line pt-8">
        {p.description ? <Markdown text={p.description} /> : <p className="text-muted">No write-up yet.</p>}
      </div>
    </article>
  );
}
