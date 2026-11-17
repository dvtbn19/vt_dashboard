import { profile as P, impact, type Seg } from "@/lib/profile";
import { getLang, pick, t } from "@/lib/i18n";
import { getTheme } from "@/lib/theme";
import { listProjects, listReports } from "@/lib/db";
import { CareerChart } from "@/components/CareerChart";
import { LangToggle } from "@/components/LangToggle";
import { ThemeToggle } from "@/components/LabChrome";

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

  const d = t(lang);
  const theme = await getTheme();
  const navLinks = [
    ["#projects", vi ? "Dự án" : "Projects"],
    ["#experience", vi ? "Kinh nghiệm" : "Experience"],
    ["#contact", vi ? "Liên hệ" : "Contact"],
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[8px] focus:bg-sheet focus:px-3 focus:py-2">
        {vi ? "Chuyển tới nội dung" : "Skip to content"}
      </a>

      <header className="sticky top-0 z-30 border-b border-rule bg-paper/85 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="wrap flex h-16 items-center gap-6">
          <a href="#main" className="flex items-center gap-2.5 text-[16px] font-bold tracking-tight">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-[9px] bg-ink text-[12.5px] font-bold text-paper">
              WD
            </span>
            <span className="hidden sm:inline">William Doan</span>
          </a>
          <nav aria-label={vi ? "Mục" : "Sections"} className="hidden items-center gap-1 text-[15px] font-medium text-pencil md:flex">
            {navLinks.map(([href, label]) => (
              <a key={href} href={href} className="rounded-[8px] px-3 py-2 hover:bg-raised hover:text-ink">
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <LangToggle lang={lang} />
            <ThemeToggle theme={theme} labels={{ dark: d.toDark, light: d.toLight }} />
            <a href={lab()} className="btn btn-primary btn-sm ml-1">
              {vi ? "Mở Lab" : "Open the Lab"}
            </a>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {/* Hero */}
        <section className="wrap pb-12 pt-10 md:pb-16 md:pt-16">
          <p className="inline-flex items-center gap-2 rounded-full border border-rule bg-sheet px-3 py-1.5 text-[13.5px] font-medium text-pencil">
            <span className="live-dot" aria-hidden />
            {vi ? "Sydney. Data analyst, data engineer, AI engineer." : "Sydney. Data analyst, data engineer, AI engineer."}
          </p>
          <h1 className="mt-5 max-w-[18ch] text-[38px] font-bold leading-[1.04] tracking-[-0.03em] sm:text-[52px] lg:text-[64px]">
            {vi ? "Tôi biến câu hỏi kinh doanh thành dữ liệu có câu trả lời." : "I turn business questions into data that answers them."}
          </h1>
          <p className="mt-5 max-w-[60ch] text-[17px] leading-relaxed text-pencil sm:text-[19px]">{L(P.intro)}</p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <a href="#contact" className="btn btn-primary">
              {vi ? "Liên hệ William" : "Contact William"}
            </a>
            <a href={lab()} className="btn">
              {vi ? "Xem agent đang làm gì" : "See what the agents are doing"}
            </a>
          </div>

          <div className="mt-10 md:mt-14">
            <CareerChart lang={lang} />
          </div>
        </section>

        {/* Impact, numbers highlighted */}
        <section aria-labelledby="impact-h" className="wrap pb-12 md:pb-16">
          <div className="panel grid gap-6 p-6 sm:p-8 lg:grid-cols-[260px_1fr] lg:gap-12 lg:p-10">
            <h2 id="impact-h" className="text-[24px] font-bold leading-tight tracking-[-0.015em]">
              {vi ? "Những gì dữ liệu đã thay đổi" : "What the data changed"}
            </h2>
            <div className="flex max-w-[62ch] flex-col gap-5 text-[17px] leading-[1.65] sm:text-[19px]">
              {impact.map((p, i) => (
                <p key={i}>
                  <Segs segs={p[lang]} />
                </p>
              ))}
            </div>
          </div>
        </section>

        {/* Projects */}
        <section id="projects" aria-labelledby="projects-h" className="wrap scroll-mt-20 pb-12 md:pb-16">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <h2 id="projects-h" className="text-[28px] font-bold tracking-[-0.02em] sm:text-[32px]">
              {vi ? "Dự án" : "Projects"}
            </h2>
            <a href={lab()} className="inline-flex min-h-[40px] items-center text-[15px] font-medium text-signal hover:underline">
              {vi ? "Nhật ký phân tích trong Lab" : "Analysis log in the Lab"}
            </a>
          </div>

          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
            {projects.map((p) => (
              <a key={p.slug} href={lab(`/p/${p.slug}`)} className="panel flex min-w-0 flex-col gap-3 p-5 sm:p-6 md:col-span-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-[20px] font-semibold leading-snug">{pick(lang, p.title, p.title_vi)}</h3>
                  <span className="status" data-s="running">
                    {vi ? "đang xây dựng" : "in progress"}
                  </span>
                </div>
                <p className="max-w-[72ch] text-pencil">{pick(lang, p.summary, p.summary_vi)}</p>
                <div className="flex max-w-[420px] items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                    <div className="h-full rounded-full bg-signal" style={{ width: `${p.progress}%` }} />
                  </div>
                  <span className="text-[13px] font-medium text-pencil tnum">{p.progress}%</span>
                </div>
                <ul className="flex flex-wrap gap-1.5">
                  {p.tags.map((tg) => (
                    <li key={tg} className="rounded-full bg-raised px-2.5 py-1 text-[12.5px] font-medium text-pencil">
                      {tg}
                    </li>
                  ))}
                </ul>
                {reports.filter((r) => r.project_slug === p.slug).length ? (
                  <div className="mt-1 border-t border-rule pt-3">
                    <p className="text-[13px] font-medium text-pencil">{vi ? "Mới nhất từ Lab" : "Latest from the Lab"}</p>
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {reports
                        .filter((r) => r.project_slug === p.slug)
                        .map((r) => (
                          <li key={r.id} className="truncate text-[15px]">
                            {r.title}
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : null}
              </a>
            ))}
            {P.projects.map((p, i) => (
              <article key={i} className="panel flex min-w-0 flex-col gap-3 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-[18px] font-semibold leading-snug">{L(p.title)}</h3>
                  <span className="mark flex-none text-[15px] font-bold">{p.metric}</span>
                </div>
                <p className="text-[15.5px] leading-relaxed text-pencil">{L(p.d)}</p>
                <p className="mt-auto text-[13px] font-medium text-pencil">{p.tag}</p>
                <ul className="flex flex-wrap gap-1.5">
                  {p.stack.map((s) => (
                    <li key={s} className="rounded-full bg-raised px-2.5 py-1 text-[12.5px] font-medium text-pencil">
                      {s}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* Experience: a real sequence, so dates lead */}
        <section id="experience" aria-labelledby="exp-h" className="wrap scroll-mt-20 pb-12 md:pb-16">
          <h2 id="exp-h" className="mb-5 text-[28px] font-bold tracking-[-0.02em] sm:text-[32px]">
            {vi ? "Kinh nghiệm" : "Experience"}
          </h2>
          <ol className="panel divide-y divide-rule">
            {P.experience.map((e, i) => (
              <li key={i} className="grid gap-2 p-5 sm:p-6 md:grid-cols-[190px_1fr] md:gap-8">
                <div className="text-[14px] text-pencil tnum">
                  <div className="font-semibold text-ink">{e.when}</div>
                  <div>{e.where}</div>
                </div>
                <div>
                  <h3 className="text-[17px] font-semibold leading-snug">
                    {L(e.role)}
                    <span className="block text-[15px] font-medium text-pencil">{e.org}</span>
                  </h3>
                  <ul className="mt-2.5 flex max-w-[70ch] list-disc flex-col gap-1.5 pl-5 text-[15.5px] text-pencil marker:text-signal">
                    {e.pts.map((pt, j) => (
                      <li key={j}>{L(pt)}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Toolkit + education */}
        <section aria-label={vi ? "Kỹ năng và học vấn" : "Skills and education"} className="wrap grid gap-4 pb-12 md:grid-cols-2 md:pb-16">
          <div className="panel p-5 sm:p-6">
            <h2 className="text-[20px] font-bold">{vi ? "Công cụ" : "Toolkit"}</h2>
            <dl className="mt-4 flex flex-col gap-4">
              {P.skills.map((s, i) => (
                <div key={i}>
                  <dt className="text-[13px] font-semibold text-pencil">{L(s.g)}</dt>
                  <dd className="mt-1.5 flex flex-wrap gap-1.5">
                    {s.items.map((it) => (
                      <span key={it} className="rounded-full border border-rule bg-raised px-2.5 py-1 text-[13px] font-medium">
                        {it}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="panel p-5 sm:p-6">
            <h2 className="text-[20px] font-bold">{vi ? "Học vấn" : "Education"}</h2>
            <ul className="mt-4 flex flex-col gap-4">
              {P.education.map((e, i) => (
                <li key={i} className="rounded-[12px] bg-raised p-4">
                  <div className="font-semibold leading-snug">{e.t}</div>
                  <div className="text-[14.5px] text-pencil">
                    {e.o}, {e.w}
                  </div>
                  {L(e.n) ? <div className="mt-1 text-[14px] font-medium text-signal">{L(e.n)}</div> : null}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" aria-labelledby="contact-h" className="wrap scroll-mt-20 pb-16 md:pb-24">
          <div className="panel relative overflow-hidden p-6 sm:p-10">
            <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-signal/20 blur-3xl" />
            <h2 id="contact-h" className="relative max-w-[20ch] text-[30px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[40px] lg:text-[48px]">
              {vi ? "Bạn có dữ liệu cần được hiểu? Hãy nói chuyện." : "Have data that needs understanding? Let's talk."}
            </h2>
            <div className="relative mt-7 flex flex-wrap gap-2.5">
              <a href={`mailto:${P.email}`} className="btn btn-primary">
                {vi ? "Gửi email cho William" : "Email William"}
              </a>
              <a href={P.linkedin} target="_blank" rel="noopener noreferrer" className="btn">
                LinkedIn
              </a>
              <a href={P.github} target="_blank" rel="noopener noreferrer" className="btn">
                GitHub
              </a>
            </div>
            <p className="relative mt-5 text-[14.5px] text-pencil">{P.email}</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="wrap flex flex-wrap items-center justify-between gap-2 py-6 text-[14px] text-pencil">
          <span>© 2026 {P.name}</span>
          <a href={lab()} className="hover:text-ink">
            lab.vtcons.com
          </a>
        </div>
      </footer>
    </div>
  );
}
