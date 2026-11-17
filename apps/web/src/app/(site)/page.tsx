import Link from "next/link";
import { CareerLanes } from "@/components/CareerLanes";
import { impact, profile, type Seg } from "@/content/profile";
import { getPublicProjects } from "@/lib/public";
import { categoryLabel } from "@/lib/types";

// Rendered per request; the API response itself is cached for 5 minutes (see lib/public.ts).
export const dynamic = "force-dynamic";

function Segments({ segs }: { segs: Seg[] }) {
  return (
    <>
      {segs.map((s, i) =>
        typeof s === "string" ? (
          <span key={i}>{s}</span>
        ) : (
          <strong key={i} className="tnum font-semibold text-ink">
            {s.m}
          </strong>
        ),
      )}
    </>
  );
}

function SectionHead({ id, title, children }: { id?: string; title: string; children?: React.ReactNode }) {
  return (
    <div id={id} className="mb-8 scroll-mt-8 border-t border-line pt-6 md:grid md:grid-cols-[240px_1fr] md:gap-10">
      <h2 className="text-[20px] font-bold leading-tight tracking-tight">{title}</h2>
      {children && <p className="mt-2 max-w-[62ch] text-muted md:mt-0">{children}</p>}
    </div>
  );
}

export default async function Home() {
  const labProjects = await getPublicProjects();
  return (
    <div className="wrap">
      <section className="pb-14 pt-12 md:pb-20 md:pt-20" aria-labelledby="hero">
        <p className="mb-5 text-[15px] text-muted">
          {profile.role.en} — {profile.location.en}
        </p>
        <h1 id="hero" className="max-w-[16ch] text-[40px] font-bold leading-[1.05] tracking-[-0.025em] sm:text-[56px] lg:text-[68px]">
          {profile.headline.en[0]} {profile.headline.en[1]}
        </h1>
        <p className="mt-6 max-w-[60ch] text-[17px] leading-relaxed text-muted">{profile.intro.en}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a className="btn" href={`mailto:${profile.email}`}>
            Email me
          </a>
          <a className="btn btn-quiet" href={profile.linkedin} rel="noopener noreferrer" target="_blank">
            LinkedIn
          </a>
          <a className="btn btn-quiet" href={profile.github} rel="noopener noreferrer" target="_blank">
            GitHub
          </a>
        </div>
      </section>

      <section className="pb-16">
        <SectionHead title="The path so far">
          Read left to right: the work moved from advising clients and writing requirements toward building the data
          systems behind those decisions.
        </SectionHead>
        <CareerLanes />
      </section>

      <section className="pb-16">
        <SectionHead title="What it added up to" />
        <div className="grid gap-8 md:grid-cols-3">
          {impact.map((p, i) => (
            <p key={i} className="text-[16.5px] leading-relaxed text-muted">
              <Segments segs={p.en} />
            </p>
          ))}
        </div>
      </section>

      <section className="pb-16">
        <SectionHead id="work" title="Selected work">
          Three projects that show the range: agents, distributed pipelines and event-driven automation.
        </SectionHead>
        <ul className="divide-y divide-line border-y border-line">
          {profile.projects.map((p) => (
            <li key={p.title.en} className="grid gap-3 py-6 md:grid-cols-[1fr_180px] md:gap-10">
              <div>
                <p className="text-[13.5px] text-muted">{p.tag}</p>
                <h3 className="mt-1 text-[19px] font-bold leading-snug">{p.title.en}</h3>
                <p className="mt-2 max-w-[68ch] text-muted">{p.d.en}</p>
                <p className="mt-3 text-[14px] text-muted">{p.stack.join(", ")}</p>
              </div>
              <p className="tnum text-[22px] font-bold text-accent md:text-right">{p.metric}</p>
            </li>
          ))}
        </ul>
        {labProjects.length > 0 && (
          <div className="mt-10">
            <h3 className="mb-3 text-[16px] font-bold">Published from the lab</h3>
            <ul className="grid gap-3 sm:grid-cols-2">
              {labProjects.slice(0, 4).map((p) => (
                <li key={p.slug}>
                  <Link href={`/projects/${p.slug}`} className="sheet block p-4 hover:border-accent">
                    <p className="text-[13px] text-muted">{categoryLabel(p.category)}</p>
                    <p className="font-semibold">{p.name}</p>
                    {p.summary && <p className="mt-1 text-[14.5px] text-muted">{p.summary}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="pb-16">
        <SectionHead title="Experience" />
        <ol className="space-y-10">
          {profile.experience.map((e) => (
            <li key={e.org} className="md:grid md:grid-cols-[240px_1fr] md:gap-10">
              <div className="mb-2 text-[14px] text-muted md:mb-0">
                <p className="tnum">{e.when}</p>
                <p>{e.where}</p>
              </div>
              <div>
                <h3 className="text-[17px] font-bold leading-snug">
                  {e.role.en}, {e.org}
                </h3>
                <ul className="mt-2 max-w-[70ch] list-disc space-y-1.5 pl-5 text-muted marker:text-line">
                  {e.pts.map((pt) => (
                    <li key={pt.en}>{pt.en}</li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="pb-16">
        <SectionHead title="Tools and training" />
        <div className="grid gap-10 md:grid-cols-2">
          <dl className="space-y-4">
            {profile.skills.map((s) => (
              <div key={s.g.en}>
                <dt className="text-[14px] font-semibold">{s.g.en}</dt>
                <dd className="text-muted">{s.items.join(", ")}</dd>
              </div>
            ))}
          </dl>
          <ul className="space-y-4">
            {profile.education.map((ed) => (
              <li key={ed.t}>
                <p className="font-semibold leading-snug">{ed.t}</p>
                <p className="text-muted">
                  {ed.o}, <span className="tnum">{ed.w}</span>
                </p>
                {ed.n.en && <p className="text-[14px] text-muted">{ed.n.en}</p>}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="pb-4">
        <SectionHead id="contact" title="Contact">
          Open to data analyst, data engineer and AI engineer roles in Sydney. Email is the fastest way to reach me.
        </SectionHead>
        <ul className="flex flex-col gap-2 text-[17px] md:ml-[280px]">
          <li>
            <a className="link" href={`mailto:${profile.email}`}>
              {profile.email}
            </a>
          </li>
          <li>
            <a className="link" href={profile.linkedin} rel="noopener noreferrer" target="_blank">
              LinkedIn
            </a>
          </li>
          <li>
            <a className="link" href={profile.github} rel="noopener noreferrer" target="_blank">
              GitHub
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
