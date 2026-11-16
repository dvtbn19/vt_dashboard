import Link from "next/link";
import { hasDb, listCommands, listProjects, listReports } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { dayLabel, getLang, t } from "@/lib/i18n";
import { CommandForm, ProjectList, ReportLog } from "@/components/LabParts";

export default async function LabHome() {
  const [admin, lang] = await Promise.all([isAdmin(), getLang()]);
  const d = t(lang);
  const vi = lang === "vi";
  const [projects, reports, commands] = await Promise.all([
    listProjects({ includePrivate: admin }),
    listReports({ includePrivate: admin, limit: 40 }),
    admin ? listCommands({ limit: 300 }) : Promise.resolve([]),
  ]);
  const byslug = new Map(projects.map((p) => [p.slug, p]));
  const cmdById = new Map(commands.map((c) => [c.id, c]));
  const running = reports.filter((r) => r.status === "running").length;
  const today = reports.filter((r) => dayLabel(r.created_at, lang) === (vi ? "Hôm nay" : "Today")).length;
  const waiting = commands.filter((c) => c.status === "pending" || c.status === "claimed").length;

  const summary = vi
    ? [
        running ? `${running} phân tích đang chạy` : "Không có phân tích nào đang chạy",
        `${today} báo cáo hôm nay`,
        ...(admin ? [`${waiting} lệnh đang chờ agent`] : []),
      ]
    : [
        running ? `${running} ${running === 1 ? "analysis" : "analyses"} running` : "Nothing running right now",
        `${today} ${today === 1 ? "report" : "reports"} today`,
        ...(admin ? [`${waiting} ${waiting === 1 ? "command" : "commands"} waiting for an agent`] : []),
      ];

  return (
    <div className="flex flex-col gap-10">
      {!hasDb ? (
        <p role="status" className="border-l-2 border-redpen pl-3 text-[15px]">
          {d.noDb}
        </p>
      ) : null}

      <header>
        <h1 className="max-w-[24ch] text-[33px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[41px]">{summary.join(", ")}.</h1>
        <p className="mt-3 max-w-[60ch] text-pencil">
          {vi
            ? "Đây là nhật ký các agent Claude Code của William: mỗi dòng là một phân tích, một biểu đồ hoặc một kết quả mô hình, kèm theo lệnh đã tạo ra nó."
            : "This is the log William's Claude Code agents write to. Each entry is an analysis, chart or model result, shown next to the instruction that produced it."}
        </p>
      </header>

      <div className="grid gap-12 lg:grid-cols-[1fr_340px] lg:gap-14">
        <aside className="flex flex-col gap-10 lg:col-start-2 lg:row-start-1">
          <section aria-labelledby="proj-h">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="proj-h" className="text-[21px] font-semibold">
                {d.projects}
              </h2>
              {admin ? (
                <Link href="/lab/p/new" className="link text-[15px]">
                  {d.newProject}
                </Link>
              ) : null}
            </div>
            <ProjectList projects={projects} lang={lang} d={d} admin={admin} />
          </section>
          {admin ? (
            <section className="sheet p-4 sm:p-5">
              <CommandForm d={d} projects={projects} id="home" />
            </section>
          ) : null}
        </aside>

        <section aria-labelledby="log-h" className="min-w-0 lg:col-start-1 lg:row-start-1">
          <h2 id="log-h" className="mb-3 text-[21px] font-semibold">
            {vi ? "Nhật ký" : "Log"}
          </h2>
          <ReportLog reports={reports} lang={lang} d={d} admin={admin} projects={byslug} commands={cmdById} />
        </section>
      </div>
    </div>
  );
}
