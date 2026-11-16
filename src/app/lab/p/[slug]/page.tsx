import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProject, listCommands, listReports, type Project } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { getLang, pick, t, type Dict } from "@/lib/i18n";
import { CommandForm, CommandList, Progress, ReportLog } from "@/components/LabParts";
import { StatusPill } from "@/components/Status";
import { saveProject, toggleProjectPublic } from "@/app/actions";

export default async function ProjectPage({ params }: PageProps<"/lab/p/[slug]">) {
  const { slug } = await params;
  const [admin, lang] = await Promise.all([isAdmin(), getLang()]);
  const d = t(lang);
  const vi = lang === "vi";

  if (slug === "new") {
    if (!admin) redirect("/lab/login?next=/lab/p/new");
    return (
      <div className="max-w-[640px]">
        <Link href="/lab" className="link text-[15px]">
          {d.allProjects}
        </Link>
        <h1 className="mb-8 mt-4 text-[33px] font-bold tracking-[-0.02em]">{d.newProject}</h1>
        <ProjectForm d={d} />
      </div>
    );
  }

  const p = await getProject(slug);
  if (!p || (!p.is_public && !admin)) notFound();
  const [reports, commands] = await Promise.all([
    listReports({ includePrivate: admin, project: slug, limit: 100 }),
    admin ? listCommands({ project: slug, limit: 50 }) : Promise.resolve([]),
  ]);
  const cmdById = new Map(commands.map((c) => [c.id, c]));

  return (
    <div className="flex flex-col gap-10">
      <header className="max-w-[760px]">
        <Link href="/lab" className="link text-[15px]">
          {d.allProjects}
        </Link>
        <h1 className="mt-4 text-[33px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[41px]">{pick(lang, p.title, p.title_vi)}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-pencil">
          <StatusPill status={p.status} lang={lang} />
          {admin ? <span>{p.is_public ? d.public : d.private}</span> : null}
          <span>
            {reports.length} {vi ? "báo cáo" : reports.length === 1 ? "report" : "reports"}
          </span>
        </div>
        <p className="mt-5 max-w-[64ch] text-[17px] leading-relaxed sm:text-[19px]">{pick(lang, p.summary, p.summary_vi)}</p>
        {p.tags.length ? <p className="mt-3 text-[15px] text-pencil">{p.tags.join(", ")}</p> : null}
        <div className="mt-5 max-w-[360px]">
          <Progress value={p.progress} />
        </div>
        <div className="mt-6 flex flex-wrap gap-2.5">
          {p.demo_url ? (
            <a href={p.demo_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              {d.viewDemo}
            </a>
          ) : null}
          {p.repo_url ? (
            <a href={p.repo_url} target="_blank" rel="noopener noreferrer" className="btn">
              {d.viewRepo}
            </a>
          ) : null}
          {admin ? (
            <form action={toggleProjectPublic.bind(null, p.slug)}>
              <button className="btn">{p.is_public ? d.makePrivate : d.makePublic}</button>
            </form>
          ) : null}
        </div>
      </header>

      <div className="grid gap-12 lg:grid-cols-[1fr_360px] lg:gap-14">
        <section aria-labelledby="plog-h" className="min-w-0">
          <h2 id="plog-h" className="mb-3 text-[21px] font-semibold">
            {vi ? "Nhật ký phân tích" : "Analysis log"}
          </h2>
          <ReportLog reports={reports} lang={lang} d={d} admin={admin} commands={cmdById} showProject={false} />
        </section>

        {admin ? (
          <aside className="flex flex-col gap-8">
            <section className="sheet p-4 sm:p-5">
              <CommandForm d={d} project={p.slug} id="proj" />
            </section>
            <section aria-labelledby="pcmd-h">
              <h2 id="pcmd-h" className="mb-1 text-[17px] font-semibold">
                {d.commands}
              </h2>
              <CommandList commands={commands} lang={lang} d={d} admin={admin} />
            </section>
            <details className="border-t border-rule pt-4">
              <summary className="cursor-pointer text-[15px] font-semibold hover:text-signal">{vi ? "Sửa thông tin dự án" : "Edit project details"}</summary>
              <div className="mt-5">
                <ProjectForm d={d} p={p} />
              </div>
            </details>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function ProjectForm({ d, p }: { d: Dict; p?: Project }) {
  const row = "flex flex-col gap-1.5";
  const lab = "text-[15px] font-medium";
  return (
    <form action={saveProject} className="flex flex-col gap-5">
      <div className={row}>
        <label htmlFor="f-slug" className={lab}>
          Short name (used in links and by agents)
        </label>
        <input id="f-slug" name="slug" required defaultValue={p?.slug} readOnly={Boolean(p)} className="field" placeholder="sales-forecast" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
        <div className={row}>
          <label htmlFor="f-title" className={lab}>
            Title (English)
          </label>
          <input id="f-title" name="title" required defaultValue={p?.title} className="field" />
        </div>
        <div className={row}>
          <label htmlFor="f-title-vi" className={lab}>
            Tiêu đề (tiếng Việt)
          </label>
          <input id="f-title-vi" name="title_vi" defaultValue={p?.title_vi ?? ""} className="field" />
        </div>
      </div>
      <div className={row}>
        <label htmlFor="f-sum" className={lab}>
          Summary (English)
        </label>
        <textarea id="f-sum" name="summary" rows={3} defaultValue={p?.summary} className="field" />
      </div>
      <div className={row}>
        <label htmlFor="f-sum-vi" className={lab}>
          Tóm tắt (tiếng Việt)
        </label>
        <textarea id="f-sum-vi" name="summary_vi" rows={3} defaultValue={p?.summary_vi ?? ""} className="field" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className={row}>
          <label htmlFor="f-status" className={lab}>
            {d.status}
          </label>
          <select id="f-status" name="status" defaultValue={p?.status ?? "active"} className="field">
            {["active", "paused", "done", "idea"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className={row}>
          <label htmlFor="f-prog" className={lab}>
            {d.progress} (%)
          </label>
          <input id="f-prog" name="progress" type="number" min={0} max={100} defaultValue={p?.progress ?? 0} className="field" />
        </div>
      </div>
      <div className={row}>
        <label htmlFor="f-tags" className={lab}>
          Tags, separated by commas
        </label>
        <input id="f-tags" name="tags" defaultValue={p?.tags.join(", ")} className="field" />
      </div>
      <div className={row}>
        <label htmlFor="f-demo" className={lab}>
          Demo link
        </label>
        <input id="f-demo" name="demo_url" type="url" defaultValue={p?.demo_url ?? ""} className="field" />
      </div>
      <div className={row}>
        <label htmlFor="f-repo" className={lab}>
          Code repository link
        </label>
        <input id="f-repo" name="repo_url" type="url" defaultValue={p?.repo_url ?? ""} className="field" />
      </div>
      <label className="flex min-h-[44px] items-center gap-3 text-[15px]">
        <input type="checkbox" name="is_public" defaultChecked={p?.is_public ?? false} className="h-5 w-5 accent-[var(--signal)]" />
        Show this project publicly
      </label>
      <button className="btn btn-primary self-start">{p ? "Save changes" : "Create project"}</button>
    </form>
  );
}
