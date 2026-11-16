import Link from "next/link";
import { hasDb, labStats, listCommands, listProjects, listReports } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { getLang, t } from "@/lib/i18n";
import { CommandForm, CommandList, ProjectCard, ReportRow } from "@/components/LabParts";

export default async function LabHome() {
  const [admin, lang] = await Promise.all([isAdmin(), getLang()]);
  const d = t(lang);
  const [projects, reports, stats, commands] = await Promise.all([
    listProjects({ includePrivate: admin }),
    listReports({ includePrivate: admin, limit: 25 }),
    labStats(),
    admin ? listCommands({ status: "open", limit: 6 }) : Promise.resolve([]),
  ]);
  const byslug = new Map(projects.map((p) => [p.slug, p]));
  const running = reports.filter((r) => r.status === "running").length;

  return (
    <div className="flex flex-col gap-10">
      {!hasDb ? <div className="rounded-xl border border-amber/40 bg-amber/5 p-4 text-sm text-amber">{d.noDb}</div> : null}

      <section className="rise grid-bg relative overflow-hidden rounded-3xl border border-line p-6 sm:p-10">
        <div className="relative z-10">
          <div className="label flex items-center gap-2">
            <span className="dot dot-pulse" style={{ background: "var(--lime)", color: "var(--lime)" }} />
            {lang === "vi" ? "Trực tuyến" : "Live"} · {d.hub}
          </div>
          <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-[1.05] sm:text-6xl">
            {lang === "vi" ? (
              <>
                Phòng thí nghiệm dữ liệu, <em className="text-lime">vận hành bởi agent.</em>
              </>
            ) : (
              <>
                A data lab, <em className="text-lime">run by agents.</em>
              </>
            )}
          </h1>
          <p className="mt-4 max-w-2xl text-muted">
            {lang === "vi"
              ? "Mọi phân tích, biểu đồ và kết quả mô hình do các Claude Code agent tạo ra đều được đăng ở đây theo thời gian thực — kèm theo lệnh đã sinh ra chúng."
              : "Every analysis, chart and model result produced by my Claude Code agents lands here in real time — alongside the instruction that produced it."}
          </p>
        </div>
        <div className="relative z-10 mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={d.projects} value={stats.projects} />
          <Stat label={d.reports} value={stats.reports} />
          <Stat label={d.agents} value={stats.agents} />
          <Stat label={admin ? d.openCommands : lang === "vi" ? "Đang chạy" : "Running"} value={admin ? stats.openCommands : running} accent />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="label">{d.projects}</h2>
          {admin ? (
            <Link href="/lab/p/new" className="font-mono text-xs text-lime hover:underline">
              + {d.newProject}
            </Link>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.slug} p={p} lang={lang} d={d} admin={admin} />
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section>
          <h2 className="label mb-2">{d.feed}</h2>
          <div className="card px-5">
            {reports.length ? (
              reports.map((r) => <ReportRow key={r.id} r={r} lang={lang} projects={byslug} admin={admin} d={d} />)
            ) : (
              <p className="py-8 text-center text-sm text-dim">{d.noReports}</p>
            )}
          </div>
        </section>
        {admin ? (
          <section>
            <div className="mb-2 flex items-end justify-between">
              <h2 className="label">{d.openCommands}</h2>
              <Link href="/lab/inbox" className="font-mono text-xs text-muted hover:text-fg">
                {d.inbox} →
              </Link>
            </div>
            <div className="card flex flex-col gap-4 p-4">
              <CommandForm d={d} />
              <CommandList commands={commands} lang={lang} d={d} admin={admin} />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-ink/70 p-4 backdrop-blur">
      <div className="label">{label}</div>
      <div className={`mt-1 font-mono text-3xl tabular-nums ${accent ? "text-lime" : ""}`}>{value}</div>
    </div>
  );
}
