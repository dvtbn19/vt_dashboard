import { hasDb, listCommands, listProjects, listReports } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { dayLabel, getLang, t, TZ, withinHours } from "@/lib/i18n";
import { AgentCard, agentStates, CommandList, Empty, FeedList, ProjectCard, ReportCard, StatTile, projectName } from "@/components/LabParts";
import { Notice, PageHead, SectionHead } from "@/components/PageHead";

export default async function Overview() {
  const [admin, lang] = await Promise.all([isAdmin(), getLang()]);
  const d = t(lang);
  const vi = lang === "vi";
  const [projects, reports, commands] = await Promise.all([
    listProjects({ includePrivate: admin }),
    listReports({ includePrivate: admin, limit: 100 }),
    admin ? listCommands({ limit: 300 }) : Promise.resolve([]),
  ]);
  const byslug = new Map(projects.map((p) => [p.slug, p]));
  const cmdById = new Map(commands.map((c) => [c.id, c]));

  const todayLabel = vi ? "Hôm nay" : "Today";
  const running = reports.filter((r) => r.status === "running");
  const failed = reports.filter((r) => r.status === "failed" && withinHours(r.created_at, 24));
  const today = reports.filter((r) => dayLabel(r.created_at, lang) === todayLabel);
  const waiting = commands.filter((c) => c.status === "pending" || c.status === "claimed");
  const agents = agentStates(reports).slice(0, 6);
  const attention = [...running, ...failed].slice(0, 4);
  const counts = (slug: string) => ({
    reports: reports.filter((r) => r.project_slug === slug).length,
    running: running.filter((r) => r.project_slug === slug).length,
  });

  const date = new Date().toLocaleDateString(vi ? "vi-VN" : "en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });

  return (
    <div className="flex flex-col gap-8 md:gap-10">
      <div>
        {!hasDb ? <Notice>{d.noDb}</Notice> : null}
        <PageHead
          title={d.overview}
          desc={
            <>
              <span className="capitalize">{date}</span>
              {". "}
              {vi ? "Các agent Claude Code của William đăng kết quả vào đây." : "William's Claude Code agents report here."}
            </>
          }
        />

        <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${admin ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          <StatTile label={d.runningNow} value={running.length} tone="live" href="/lab/reports?status=running" sub={running[0]?.title} />
          {admin ? <StatTile label={d.waiting} value={waiting.length} tone="warn" href="/lab/inbox" sub={waiting[0]?.body} /> : null}
          <StatTile label={d.reportsToday} value={today.length} tone="ink" href="/lab/reports" />
          <StatTile label={d.failed24} value={failed.length} tone="red" href="/lab/reports?status=failed" sub={failed[0]?.title} />
        </div>
      </div>

      {agents.length ? (
        <section aria-labelledby="agents-h">
          <SectionHead id="agents-h" title={d.agentsTitle} />
          <div className="chips !gap-3 pb-1 md:!grid md:grid-cols-2 xl:grid-cols-3">
            {agents.map((a) => (
              <AgentCard key={a.name} a={a} lang={lang} d={d} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-8">
        <div className="flex min-w-0 flex-col gap-8">
          {attention.length ? (
            <section aria-labelledby="att-h">
              <SectionHead id="att-h" title={d.needsAttention} />
              <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                {attention.map((r) => (
                  <ReportCard
                    key={r.id}
                    r={r}
                    lang={lang}
                    d={d}
                    admin={admin}
                    project={projectName(byslug.get(r.project_slug), r.project_slug, lang)}
                    cmd={r.parent_command_id ? cmdById.get(r.parent_command_id) : undefined}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="recent-h">
            <SectionHead id="recent-h" title={d.recent} href="/lab/reports" linkLabel={d.seeAll} />
            {reports.length ? <FeedList reports={reports.slice(0, 8)} lang={lang} projects={byslug} /> : <Empty d={d} lang={lang} />}
          </section>
        </div>

        <div className="flex flex-col gap-8">
          {admin ? (
            <section aria-labelledby="wait-h">
              <SectionHead id="wait-h" title={d.waiting} href="/lab/inbox" linkLabel={d.seeAll} />
              <CommandList commands={waiting.slice(0, 3)} lang={lang} d={d} admin compact />
            </section>
          ) : null}
          <section aria-labelledby="proj-h">
            <SectionHead id="proj-h" title={d.projects} href="/lab/projects" linkLabel={d.seeAll} />
            <div className="flex flex-col gap-3">
              {projects.slice(0, 3).map((p) => (
                <ProjectCard key={p.slug} p={p} lang={lang} d={d} admin={admin} counts={counts(p.slug)} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
