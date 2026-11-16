import { profile as P, impact, type Seg } from "@/lib/profile";
import { getLang, pick } from "@/lib/i18n";
import { listProjects, listReports } from "@/lib/db";
import { CareerChart } from "@/components/CareerChart";
import { LangToggle } from "@/components/LangToggle";

const LAB = process.env.LAB_PUBLIC_URL?.replace(/\/$/, "") ?? "";
const lab = (p = "") => (LAB ? `${LAB}${p}` : `/lab${p}`);

function Segs({ segs }: { segs: Seg[] }) {
  return (
    <>
      {segs.map((s, i) =>
        typeof s === "string" ? (
          <span key={i}>{s}</span>
        ) : (
          <mark key={i} className="mark font-semibold">
            {s.m}
          </mark>
        ),
      )}
    </>
  );
}

export default async function Portfolio() {
  const lang = await getLang();
  const vi = lang === "vi";
  const L = (x: { en: string; vi: string }) => x[lang];
  const [projects, reports] = await Promise.all([
    listProjects({ includePrivate: false }).catch(() => []),
    listReports({ includePrivate: false, limit: 3 }).catch(() => []),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-sheet focus:px-3 focus:py-2">
        {vi ? "Chuyển tới nội dung" : "Skip to content"}
      </a>

      <header className="border-b border-rule">
        <div className="wrap flex h-16 items-center gap-6">
          <a href="#main" className="text-[17px] font-bold tracking-tight">
            William Doan
          </a>
          <nav aria-label={vi ? "Mục" : "Sections"} className="hidden items-center gap-6 text-[15px] text-pencil md:flex">
            <a href="#projects" className="hover:text-ink">
              {vi ? "Dự án" : "Projects"}
            </a>
            <a href="#experience" className="hover:text-ink">
              {vi ? "Kinh nghiệm" : "Experience"}
            </a>
            <a href="#contact" className="hover:text-ink">
              {vi ? "Liên hệ" : "Contact"}
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <LangToggle lang={lang} />
            <a href={lab()} className="btn btn-primary !min-h-[38px] !px-3.5 !text-[14px]">
              {vi ? "Mở Lab" : "Open the Lab"}
            </a>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {/* Hero: the career chart is the signature element */}
        <section className="wrap pb-16 pt-12 md:pb-24 md:pt-20">
          <p className="text-[15px] text-pencil">
            {vi ? "William Doan, Sydney. Data analyst, data engineer và AI engineer." : "William Doan, Sydney. Data analyst, data engineer and AI engineer."}
          </p>
          <h1 className="mt-4 max-w-[17ch] text-[41px] font-bold leading-[1.05] tracking-[-0.025em] sm:text-[52px] lg:text-[64px]">
            {vi ? "Tôi biến câu hỏi kinh doanh thành dữ liệu có câu trả lời." : "I turn business questions into data that answers them."}
          </h1>
          <p className="mt-6 max-w-[60ch] text-[17px] leading-relaxed text-pencil sm:text-[19px]">{L(P.intro)}</p>

          <div className="mt-10 md:mt-14">
            <CareerChart lang={lang} />
          </div>
        </section>

        {/* Impact as prose, numbers highlighted */}
        <section aria-labelledby="impact-h" className="border-t border-rule">
          <div className="wrap grid gap-8 py-16 md:py-20 lg:grid-cols-[280px_1fr] lg:gap-16">
            <h2 id="impact-h" className="text-[26px] font-semibold leading-tight tracking-[-0.01em]">
              {vi ? "Những gì dữ liệu đã thay đổi" : "What the data changed"}
            </h2>
            <div className="flex max-w-[62ch] flex-col gap-6 text-[19px] leading-[1.6] sm:text-[21px]">
              {impact.map((p, i) => (
                <p key={i}>
                  <Segs segs={p[lang]} />
                </p>
              ))}
            </div>
          </div>
        </section>

        {/* Projects as a list */}
        <section id="projects" aria-labelledby="projects-h" className="border-t border-rule">
          <div className="wrap py-16 md:py-20">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h2 id="projects-h" className="text-[33px] font-semibold tracking-[-0.015em]">
                {vi ? "Dự án" : "Projects"}
              </h2>
              <a href={lab()} className="link text-[15px]">
                {vi ? "Xem nhật ký phân tích trong Lab" : "Read the analysis log in the Lab"}
              </a>
            </div>

            <ul className="mt-8 border-t border-ink">
              {projects.map((p) => (
                <li key={p.slug} className="border-b border-rule">
                  <a href={lab(`/p/${p.slug}`)} className="group grid gap-3 py-7 md:grid-cols-[1fr_220px] md:gap-10">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-[21px] font-semibold leading-snug group-hover:text-signal">{pick(lang, p.title, p.title_vi)}</h3>
                        <span className="status" data-s="running">
                          {vi ? "đang xây dựng" : "in progress"}
                        </span>
                      </div>
                      <p className="mt-2 max-w-[64ch] text-pencil">{pick(lang, p.summary, p.summary_vi)}</p>
                      <p className="mt-3 text-[14px] text-pencil">{p.tags.join(", ")}</p>
                    </div>
                    <div className="text-[15px] md:text-right">
                      {p.demo_url ? <span className="text-signal">{p.demo_url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span> : null}
                      <p className="mt-1 text-pencil">{vi ? `Tiến độ ${p.progress}%` : `${p.progress}% built`}</p>
                    </div>
                  </a>
                </li>
              ))}
              {P.projects.map((p, i) => (
                <li key={i} className="grid gap-3 border-b border-rule py-7 md:grid-cols-[1fr_220px] md:gap-10">
                  <div>
                    <h3 className="text-[21px] font-semibold leading-snug">{L(p.title)}</h3>
                    <p className="mt-2 max-w-[64ch] text-pencil">{L(p.d)}</p>
                    <p className="mt-3 text-[14px] text-pencil">
                      {p.tag}. {p.stack.join(", ")}
                    </p>
                  </div>
                  <div className="md:text-right">
                    <span className="text-[21px] font-semibold tabular-nums">{p.metric}</span>
                  </div>
                </li>
              ))}
            </ul>

            {reports.length ? (
              <div className="mt-10">
                <h3 className="text-[17px] font-semibold">{vi ? "Mới nhất từ Lab" : "Latest from the Lab"}</h3>
                <ul className="mt-3 flex flex-col gap-2">
                  {reports.map((r) => (
                    <li key={r.id}>
                      <a href={lab(`/r/${r.id}`)} className="link">
                        {r.title}
                      </a>
                      <span className="text-[14px] text-pencil"> ({r.project_slug})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        {/* Experience: a real sequence, so dates lead */}
        <section id="experience" aria-labelledby="exp-h" className="border-t border-rule">
          <div className="wrap py-16 md:py-20">
            <h2 id="exp-h" className="text-[33px] font-semibold tracking-[-0.015em]">
              {vi ? "Kinh nghiệm" : "Experience"}
            </h2>
            <ol className="mt-8 border-t border-ink">
              {P.experience.map((e, i) => (
                <li key={i} className="grid gap-2 border-b border-rule py-7 md:grid-cols-[200px_1fr] md:gap-10">
                  <div className="text-[15px] tabular-nums text-pencil">
                    <div>{e.when}</div>
                    <div>{e.where}</div>
                  </div>
                  <div>
                    <h3 className="text-[19px] font-semibold leading-snug">
                      {L(e.role)}, <span className="font-normal">{e.org}</span>
                    </h3>
                    <ul className="mt-3 flex max-w-[66ch] list-disc flex-col gap-1.5 pl-5 text-pencil marker:text-rule">
                      {e.pts.map((pt, j) => (
                        <li key={j}>{L(pt)}</li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Toolkit + education */}
        <section aria-label={vi ? "Kỹ năng và học vấn" : "Skills and education"} className="border-t border-rule">
          <div className="wrap grid gap-12 py-16 md:grid-cols-2 md:py-20">
            <div>
              <h2 className="text-[26px] font-semibold">{vi ? "Công cụ" : "Toolkit"}</h2>
              <dl className="mt-6 flex flex-col gap-5">
                {P.skills.map((s, i) => (
                  <div key={i}>
                    <dt className="text-[14px] font-semibold">{L(s.g)}</dt>
                    <dd className="mt-1 text-pencil">{s.items.join(", ")}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h2 className="text-[26px] font-semibold">{vi ? "Học vấn" : "Education"}</h2>
              <ul className="mt-6 flex flex-col gap-5">
                {P.education.map((e, i) => (
                  <li key={i}>
                    <div className="font-semibold leading-snug">{e.t}</div>
                    <div className="text-pencil">
                      {e.o}, {e.w}
                    </div>
                    {L(e.n) ? <div className="mt-1 text-[15px]">{L(e.n)}</div> : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" aria-labelledby="contact-h" className="border-t border-ink bg-ink text-paper">
          <div className="wrap py-16 md:py-24">
            <h2 id="contact-h" className="max-w-[20ch] text-[33px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[41px] lg:text-[52px]">
              {vi ? "Bạn có dữ liệu cần được hiểu? Hãy nói chuyện." : "Have data that needs understanding? Let's talk."}
            </h2>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={`mailto:${P.email}`} className="btn btn-paper">
                {vi ? "Gửi email cho William" : "Email William"}
              </a>
              <a href={P.linkedin} target="_blank" rel="noopener noreferrer" className="btn btn-on-ink">
                LinkedIn
              </a>
              <a href={P.github} target="_blank" rel="noopener noreferrer" className="btn btn-on-ink">
                GitHub
              </a>
            </div>
            <p className="mt-6 text-[15px] text-paper/70">{P.email}</p>
          </div>
        </section>
      </main>

      <footer className="bg-ink text-paper/60">
        <div className="wrap flex flex-wrap items-center justify-between gap-2 border-t border-paper/15 py-6 text-[14px]">
          <span>© 2026 {P.name}</span>
          <a href={lab()} className="hover:text-paper">
            lab.vtcons.com
          </a>
        </div>
      </footer>
    </div>
  );
}
