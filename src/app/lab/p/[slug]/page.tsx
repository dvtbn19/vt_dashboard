import { notFound, redirect } from "next/navigation";
import { getProject, listCommands, listReports, type Project } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { getLang, pick, t, type Dict } from "@/lib/i18n";
import { Progress, Thread } from "@/components/LabParts";
import { ComposeButton } from "@/components/LabChrome";
import { StatusPill } from "@/components/Status";
import { IconExternal, IconGlobe, IconLock, IconPlus } from "@/components/Icons";
import { PageHead } from "@/components/PageHead";
import { saveProject, toggleProjectPublic } from "@/app/actions";

export default async function ProjectPage({ params }: PageProps<"/lab/p/[slug]">) {
  const { slug } = await params;
  const [admin, lang] = await Promise.all([isAdmin(), getLang()]);
  const d = t(lang);
  const vi = lang === "vi";
  const back = { href: "/lab/projects", label: d.projects };

  if (slug === "new") {
    if (!admin) redirect("/lab/login?next=/lab/p/new");
    return (
      <div className="mx-auto max-w-[640px]">
        <PageHead title={d.newProject} back={back} />
        <div className="panel p-5 sm:p-6">
          <ProjectForm d={d} />
        </div>
      </div>
    );
  }

  const p = await getProject(slug);
  if (!p || (!p.is_public && !admin)) notFound();
  const [reports, commands] = await Promise.all([
    listReports({ includePrivate: admin, project: slug, limit: 100 }),
    admin ? listCommands({ project: slug, limit: 100 }) : Promise.resolve([]),
  ]);
  const running = reports.filter((r) => r.status === "running").length;
  const open = commands.filter((c) => c.status === "pending" || c.status === "claimed").length;

  return (
    <div>
      <PageHead
        back={back}
        title={pick(lang, p.title, p.title_vi)}
        actions={
          admin ? (
            <ComposeButton className="btn btn-primary hidden lg:inline-flex" project={p.slug} context={pick(lang, p.title, p.title_vi)}>
              <IconPlus size={18} />
              {d.newTask}
            </ComposeButton>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
        <aside className="flex flex-col gap-4 lg:col-start-2 lg:row-start-1">
          <section className="panel flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-pencil">
              <StatusPill status={p.status} lang={lang} />
              {admin ? (
                <span className="inline-flex items-center gap-1">
                  {p.is_public ? <IconGlobe size={14} /> : <IconLock size={14} />}
                  {p.is_public ? d.public : d.private}
                </span>
              ) : null}
            </div>
            <p className="text-[15px] leading-relaxed">{pick(lang, p.summary, p.summary_vi)}</p>
            <Progress value={p.progress} />
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                [reports.length, d.reports],
                [running, vi ? "Đang chạy" : "Running"],
                ...(admin ? [[open, vi ? "Lệnh chờ" : "Waiting"]] : []),
              ].map(([n, label]) => (
                <div key={String(label)} className="flex flex-col-reverse rounded-[10px] bg-raised px-2 py-2.5">
                  <dt className="mt-1 text-[12px] text-pencil">{label}</dt>
                  <dd className="text-[20px] font-bold leading-none tnum">{n}</dd>
                </div>
              ))}
            </dl>
            {p.tags.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {p.tags.map((tg) => (
                  <li key={tg} className="rounded-full bg-raised px-2.5 py-1 text-[12.5px] font-medium text-pencil">
                    {tg}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {p.demo_url ? (
                <a href={p.demo_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
                  {d.viewDemo}
                  <IconExternal size={15} />
                </a>
              ) : null}
              {p.repo_url ? (
                <a href={p.repo_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
                  {d.viewRepo}
                  <IconExternal size={15} />
                </a>
              ) : null}
              {admin ? (
                <form action={toggleProjectPublic.bind(null, p.slug)}>
                  <button className="btn btn-sm btn-ghost">{p.is_public ? d.makePrivate : d.makePublic}</button>
                </form>
              ) : null}
            </div>
          </section>
          {admin ? (
            <details className="panel group p-5">
              <summary className="flex min-h-[28px] cursor-pointer list-none items-center justify-between text-[15px] font-semibold">
                {vi ? "Sửa thông tin dự án" : "Edit project details"}
                <span aria-hidden className="text-pencil transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="mt-5">
                <ProjectForm d={d} p={p} />
              </div>
            </details>
          ) : null}
        </aside>

        <section aria-labelledby="thread-h" className="min-w-0 lg:col-start-1 lg:row-start-1">
          <h2 id="thread-h" className="mb-3 text-[17px] font-semibold">
            {vi ? "Luồng công việc" : "Work thread"}
          </h2>
          <Thread reports={reports} commands={commands} lang={lang} d={d} admin={admin} />
        </section>
      </div>
    </div>
  );
}

function ProjectForm({ d, p }: { d: Dict; p?: Project }) {
  const row = "flex flex-col gap-1.5";
  const lab = "text-[14px] font-medium text-pencil";
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
