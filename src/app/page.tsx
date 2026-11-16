import Link from "next/link";
import { profile as P } from "@/lib/profile";
import { getLang, pick } from "@/lib/i18n";
import { listProjects, listReports } from "@/lib/db";
import { NetworkCanvas } from "@/components/NetworkCanvas";
import { LangToggle } from "@/components/LangToggle";

const LAB = process.env.LAB_PUBLIC_URL?.replace(/\/$/, "") ?? "";
const lab = (p = "") => (LAB ? `${LAB}${p}` : `/lab${p}`);

export default async function Portfolio() {
  const lang = await getLang();
  const L = (x: { en: string; vi: string }) => x[lang];
  const [projects, reports] = await Promise.all([
    listProjects({ includePrivate: false }).catch(() => []),
    listReports({ includePrivate: false, limit: 4 }).catch(() => []),
  ]);
  const vi = lang === "vi";

  return (
    <div className="relative">
      {/* nav */}
      <header className="fixed inset-x-0 top-0 z-40">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <a href="#top" className="font-mono text-sm font-semibold tracking-tight">
            william<span className="text-lime">.</span>doan
          </a>
          <nav className="ml-auto hidden items-center gap-5 text-sm text-muted md:flex">
            <a href="#work" className="hover:text-fg">
              {vi ? "Năng lực" : "Work"}
            </a>
            <a href="#projects" className="hover:text-fg">
              {vi ? "Dự án" : "Projects"}
            </a>
            <a href="#experience" className="hover:text-fg">
              {vi ? "Kinh nghiệm" : "Experience"}
            </a>
            <a href="#contact" className="hover:text-fg">
              {vi ? "Liên hệ" : "Contact"}
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <LangToggle lang={lang} />
            <a href={lab()} className="btn btn-lime !py-1.5 text-xs">
              Lab ↗
            </a>
          </div>
        </div>
      </header>

      {/* hero */}
      <section id="top" className="relative flex min-h-[100svh] items-end overflow-hidden">
        <NetworkCanvas className="absolute inset-0 h-full w-full" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/20 via-ink/40 to-ink" />
        <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-32 sm:pb-24">
          <div className="label rise flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="dot dot-pulse" style={{ background: "var(--lime)", color: "var(--lime)" }} />
            <span>{L(P.location)}</span>
            <span className="text-dim">/</span>
            <span>{L(P.role)}</span>
          </div>
          <h1 className="rise mt-6 font-serif text-[13vw] leading-[0.92] tracking-tight sm:text-[8.5vw] lg:text-[112px]" style={{ animationDelay: "80ms" }}>
            {P.headline[lang][0]}
            <br />
            <em className="text-lime">{P.headline[lang][1]}</em>
          </h1>
          <div className="rise mt-8 grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-end" style={{ animationDelay: "160ms" }}>
            <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">{L(P.intro)}</p>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <a href={lab()} className="btn btn-lime">
                {vi ? "Xem Lab đang chạy" : "See the live Lab"} →
              </a>
              <a href="#contact" className="btn">
                {vi ? "Liên hệ" : "Get in touch"}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* numbers marquee */}
      <section aria-label="Impact" className="overflow-hidden border-y border-line bg-ink-2 py-5">
        <div className="marquee flex w-max gap-12 whitespace-nowrap">
          {[...P.numbers, ...P.numbers].map((n, i) => (
            <div key={i} className="flex items-baseline gap-3">
              <span className="font-mono text-2xl text-lime">{n.v}</span>
              <span className="text-sm text-muted">{L(n.l)}</span>
              <span className="ml-9 text-dim">✦</span>
            </div>
          ))}
        </div>
      </section>

      {/* pillars */}
      <section id="work" className="mx-auto max-w-6xl px-4 py-24">
        <div className="grid gap-10 md:grid-cols-[1fr_2fr]">
          <div>
            <p className="label">{vi ? "Tôi làm gì" : "What I do"}</p>
            <h2 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">
              {vi ? (
                <>
                  Từ câu hỏi kinh doanh <em className="text-violet">đến hệ thống tự chạy.</em>
                </>
              ) : (
                <>
                  From the business question <em className="text-violet">to a system that runs itself.</em>
                </>
              )}
            </h2>
          </div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
            {P.pillars.map((p) => (
              <div key={p.k} className="flex flex-col gap-4 bg-ink p-6">
                <span className="font-mono text-xs text-lime">{p.k}</span>
                <h3 className="text-xl font-semibold">{L(p.t)}</h3>
                <p className="text-sm leading-relaxed text-muted">{L(p.d)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* projects */}
      <section id="projects" className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label">{vi ? "Dự án chọn lọc" : "Selected projects"}</p>
              <h2 className="mt-3 font-serif text-4xl sm:text-5xl">{vi ? "Những gì tôi đã xây." : "Things I've built."}</h2>
            </div>
            <a href={lab()} className="font-mono text-sm text-lime hover:underline">
              {vi ? "Tất cả trong Lab" : "Everything in the Lab"} →
            </a>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {projects.map((p) => (
              <a
                key={p.slug}
                href={lab(`/p/${p.slug}`)}
                className="card group relative overflow-hidden p-6 transition hover:border-lime lg:col-span-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-lime px-2 py-0.5 font-mono text-[11px] font-semibold uppercase text-ink">
                    {vi ? "Đang xây" : "Building now"}
                  </span>
                  {p.tags.slice(0, 4).map((t) => (
                    <span key={t} className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted">
                      {t}
                    </span>
                  ))}
                </div>
                <h3 className="mt-4 font-serif text-3xl leading-tight group-hover:text-lime sm:text-4xl">{pick(lang, p.title, p.title_vi)}</h3>
                <p className="mt-3 max-w-3xl text-muted">{pick(lang, p.summary, p.summary_vi)}</p>
                <div className="mt-5 flex flex-wrap gap-4 font-mono text-xs">
                  {p.demo_url ? <span className="text-lime">{p.demo_url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")} ↗</span> : null}
                  <span className="text-muted">{vi ? "Nhật ký phân tích trong Lab" : "Analysis log in the Lab"} →</span>
                </div>
              </a>
            ))}
            {P.projects.map((p, i) => (
              <article key={i} className="card flex flex-col gap-4 p-6">
                <div className="flex items-center justify-between gap-2">
                  <span className="label">{p.tag}</span>
                  <span className="font-mono text-sm text-lime">{p.metric}</span>
                </div>
                <h3 className="text-xl font-semibold leading-snug">{L(p.title)}</h3>
                <p className="text-sm leading-relaxed text-muted">{L(p.d)}</p>
                <div className="mt-auto flex flex-wrap gap-1.5">
                  {p.stack.map((s) => (
                    <span key={s} className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted">
                      {s}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>

          {reports.length ? (
            <div className="mt-12">
              <p className="label mb-3 flex items-center gap-2">
                <span className="dot dot-pulse" style={{ background: "var(--lime)", color: "var(--lime)" }} />
                {vi ? "Mới đăng từ Lab" : "Fresh from the Lab"}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {reports.map((r) => (
                  <a key={r.id} href={lab(`/r/${r.id}`)} className="card p-4 transition hover:border-lime">
                    <div className="font-mono text-[11px] text-dim">
                      {r.agent ? <span className="text-violet">@{r.agent}</span> : null} · {r.project_slug}
                    </div>
                    <div className="mt-1 font-medium">{r.title}</div>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* experience */}
      <section id="experience" className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-24">
          <p className="label">{vi ? "Kinh nghiệm" : "Experience"}</p>
          <h2 className="mt-3 max-w-3xl font-serif text-4xl leading-tight sm:text-5xl">
            {vi ? (
              <>
                Mỗi vai trò đều là <em className="text-lime">một bài toán dữ liệu</em> trá hình.
              </>
            ) : (
              <>
                Every role was <em className="text-lime">a data problem</em> in disguise.
              </>
            )}
          </h2>
          <ol className="mt-12 flex flex-col">
            {P.experience.map((e, i) => (
              <li key={i} className="grid gap-4 border-t border-line py-8 md:grid-cols-[220px_1fr]">
                <div>
                  <div className="font-mono text-xs text-lime">{e.when}</div>
                  <div className="mt-1 font-mono text-xs text-dim">{e.where}</div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold">
                    {L(e.role)} <span className="font-normal text-muted">· {e.org}</span>
                  </h3>
                  <ul className="mt-3 flex flex-col gap-2">
                    {e.pts.map((pt, j) => (
                      <li key={j} className="flex gap-3 text-sm leading-relaxed text-muted">
                        <span className="mt-2 h-px w-3 flex-none bg-line-2" />
                        {L(pt)}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* skills + education */}
      <section className="border-t border-line bg-ink-2">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 md:grid-cols-2">
          <div>
            <p className="label">{vi ? "Kỹ năng" : "Toolkit"}</p>
            <div className="mt-6 flex flex-col gap-6">
              {P.skills.map((s, i) => (
                <div key={i}>
                  <div className="mb-2 text-sm text-muted">{L(s.g)}</div>
                  <div className="flex flex-wrap gap-2">
                    {s.items.map((x) => (
                      <span key={x} className="rounded-full border border-line-2 px-3 py-1 text-sm">
                        {x}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="label">{vi ? "Học vấn" : "Education"}</p>
            <div className="mt-6 flex flex-col gap-4">
              {P.education.map((e, i) => (
                <div key={i} className="card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold leading-snug">{e.t}</h3>
                    <span className="flex-none font-mono text-xs text-dim">{e.w}</span>
                  </div>
                  <div className="mt-1 text-sm text-muted">{e.o}</div>
                  {L(e.n) ? <div className="mt-2 font-mono text-xs text-lime">{L(e.n)}</div> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* contact */}
      <section id="contact" className="relative overflow-hidden border-t border-line">
        <div className="grid-bg absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-6xl px-4 py-28 text-center">
          <p className="label">{vi ? "Liên hệ" : "Contact"}</p>
          <h2 className="mx-auto mt-4 max-w-4xl font-serif text-5xl leading-[1.02] sm:text-7xl">
            {vi ? (
              <>
                Có dữ liệu cần <em className="text-lime">được hiểu?</em>
              </>
            ) : (
              <>
                Got data that needs <em className="text-lime">understanding?</em>
              </>
            )}
          </h2>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <a href={`mailto:${P.email}`} className="btn btn-lime">
              {P.email}
            </a>
            <a href={P.linkedin} target="_blank" rel="noopener noreferrer" className="btn">
              LinkedIn ↗
            </a>
            <a href={P.github} target="_blank" rel="noopener noreferrer" className="btn">
              GitHub ↗
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 font-mono text-[11px] text-dim">
          <span>© 2026 {P.name}</span>
          <Link href={lab()} className="hover:text-fg">
            lab.vtcons.com ↗
          </Link>
        </div>
      </footer>
    </div>
  );
}
