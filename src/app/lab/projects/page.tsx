import Link from "next/link";
import { listProjects, listReports } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { getLang, t } from "@/lib/i18n";
import { ProjectCard } from "@/components/LabParts";
import { IconPlus } from "@/components/Icons";
import { PageHead } from "@/components/PageHead";

export default async function Projects() {
  const [admin, lang] = await Promise.all([isAdmin(), getLang()]);
  const d = t(lang);
  const vi = lang === "vi";
  const [projects, reports] = await Promise.all([listProjects({ includePrivate: admin }), listReports({ includePrivate: admin, limit: 200 })]);

  return (
    <div>
      <PageHead
        title={d.projects}
        desc={vi ? "Mỗi dự án có luồng lệnh và báo cáo riêng." : "Each project has its own thread of commands and reports."}
        actions={
          admin ? (
            <Link href="/lab/p/new" className="btn">
              <IconPlus size={18} />
              {d.newProject}
            </Link>
          ) : null
        }
      />
      {projects.length ? (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.slug}
              p={p}
              lang={lang}
              d={d}
              admin={admin}
              counts={{
                reports: reports.filter((r) => r.project_slug === p.slug).length,
                running: reports.filter((r) => r.project_slug === p.slug && r.status === "running").length,
              }}
            />
          ))}
        </div>
      ) : (
        <p className="panel border-dashed p-6 text-pencil">{vi ? "Chưa có dự án công khai." : "No public projects yet."}</p>
      )}
    </div>
  );
}
