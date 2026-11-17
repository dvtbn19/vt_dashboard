import Link from "next/link";
import type { Metadata } from "next";
import { profile } from "@/content/profile";
import { getPublicProjects } from "@/lib/public";
import { categoryLabel } from "@/lib/types";

export const metadata: Metadata = { title: "Projects" };
// Rendered per request; the API response itself is cached for 5 minutes (see lib/public.ts).
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const lab = await getPublicProjects();
  return (
    <div className="wrap pb-8 pt-12">
      <h1 className="text-[34px] font-bold tracking-tight">Projects</h1>
      <p className="mt-3 max-w-[60ch] text-muted">
        Case studies from study and work, plus projects I have chosen to publish from my private lab.
      </p>

      <h2 className="mt-12 border-t border-line pt-6 text-[20px] font-bold">From the lab</h2>
      {lab.length === 0 ? (
        <p className="mt-3 text-muted">Nothing published from the lab yet. Lab projects are private until I mark them public.</p>
      ) : (
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {lab.map((p) => (
            <li key={p.slug}>
              <Link href={`/projects/${p.slug}`} className="grid gap-1 py-5 hover:text-accent sm:grid-cols-[1fr_160px]">
                <span>
                  <span className="block text-[17px] font-semibold">{p.name}</span>
                  {p.summary && <span className="mt-1 block text-[15px] text-muted">{p.summary}</span>}
                </span>
                <span className="text-[14px] text-muted sm:text-right">{categoryLabel(p.category)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-14 border-t border-line pt-6 text-[20px] font-bold">Case studies</h2>
      <ul className="mt-5 grid gap-8 md:grid-cols-3">
        {profile.projects.map((p) => (
          <li key={p.title.en}>
            <p className="text-[13.5px] text-muted">{p.tag}</p>
            <h3 className="mt-1 text-[17px] font-bold leading-snug">{p.title.en}</h3>
            <p className="mt-2 text-[15px] text-muted">{p.d.en}</p>
            <p className="tnum mt-3 font-bold text-accent">{p.metric}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
