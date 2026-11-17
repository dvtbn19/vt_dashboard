import Link from "next/link";
import { listCommands, listProjects, listReports } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { getLang, t } from "@/lib/i18n";
import { AgentAvatar, Empty, ReportGrid, projectName } from "@/components/LabParts";
import { PageHead } from "@/components/PageHead";

const STATUSES = ["running", "done", "failed"] as const;

export default async function Reports({ searchParams }: PageProps<"/lab/reports">) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const status = one("status");
  const project = one("project");
  const agent = one("agent");

  const [admin, lang] = await Promise.all([isAdmin(), getLang()]);
  const d = t(lang);
  const vi = lang === "vi";
  const [projects, all, commands] = await Promise.all([
    listProjects({ includePrivate: admin }),
    listReports({ includePrivate: admin, limit: 200 }),
    admin ? listCommands({ limit: 300 }) : Promise.resolve([]),
  ]);
  const byslug = new Map(projects.map((p) => [p.slug, p]));
  const cmdById = new Map(commands.map((c) => [c.id, c]));

  const shown = all.filter(
    (r) => (!status || r.status === status) && (!project || r.project_slug === project) && (!agent || r.agent === agent),
  );
  const agents = [...new Set(all.map((r) => r.agent).filter((a): a is string => Boolean(a)))];

  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const next = { status, project, agent, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) q.set(k, v);
    const s = q.toString();
    return `/lab/reports${s ? `?${s}` : ""}`;
  };
  const statusWord: Record<string, string> = vi
    ? { running: "Đang chạy", done: "Xong", failed: "Lỗi" }
    : { running: "Running", done: "Done", failed: "Failed" };
  const count = (s?: string) => all.filter((r) => (!s || r.status === s) && (!project || r.project_slug === project) && (!agent || r.agent === agent)).length;

  return (
    <div>
      <PageHead
        title={d.reports}
        desc={
          vi
            ? `${shown.length} báo cáo${status || project || agent ? " khớp bộ lọc" : ""}. Bấm vào thẻ để xem biểu đồ, bảng và kết quả đầy đủ.`
            : `${shown.length} ${shown.length === 1 ? "report" : "reports"}${status || project || agent ? " match these filters" : ""}. Open a card for the full charts, tables and results.`
        }
      />

      <div className="mb-6 flex flex-col gap-3">
        <nav aria-label={d.status} className="chips">
          <Link href={href({ status: undefined })} aria-current={!status ? "true" : undefined} className="chip">
            {d.allStatuses} <span className="count">{count()}</span>
          </Link>
          {STATUSES.map((s) => (
            <Link key={s} href={href({ status: s })} aria-current={status === s ? "true" : undefined} className="chip">
              <span className="status !text-inherit" data-s={s} aria-hidden />
              {statusWord[s]} <span className="count">{count(s)}</span>
            </Link>
          ))}
        </nav>
        {projects.length > 1 || agents.length ? (
          <nav aria-label={`${d.projects}, ${d.agentsTitle}`} className="chips">
            {projects.length > 1
              ? projects.map((p) => (
                  <Link
                    key={p.slug}
                    href={href({ project: project === p.slug ? undefined : p.slug })}
                    aria-current={project === p.slug ? "true" : undefined}
                    className="chip"
                  >
                    {projectName(p, p.slug, lang)}
                  </Link>
                ))
              : null}
            {agents.map((a) => (
              <Link key={a} href={href({ agent: agent === a ? undefined : a })} aria-current={agent === a ? "true" : undefined} className="chip !pl-1.5">
                <AgentAvatar name={a} size={26} />
                {a}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

      {shown.length ? (
        <ReportGrid reports={shown} lang={lang} d={d} admin={admin} projects={byslug} commands={cmdById} showProject={!project} />
      ) : all.length ? (
        <div className="panel flex flex-col items-start gap-3 border-dashed p-6">
          <p className="text-pencil">{d.noMatch}</p>
          <Link href="/lab/reports" className="btn btn-sm">
            {d.clearFilters}
          </Link>
        </div>
      ) : (
        <Empty d={d} lang={lang} />
      )}
    </div>
  );
}
