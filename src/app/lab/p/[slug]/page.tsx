import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProject, listCommands, listReports, type Project } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { getLang, pick, t, type Dict } from "@/lib/i18n";
import { CommandForm, CommandList, Progress, ReportRow } from "@/components/LabParts";
import { StatusPill, VisibilityPill } from "@/components/Status";
import { saveProject, toggleProjectPublic } from "@/app/actions";

export default async function ProjectPage({ params }: PageProps<"/lab/p/[slug]">) {
  const { slug } = await params;
  const [admin, lang] = await Promise.all([isAdmin(), getLang()]);
  const d = t(lang);

  if (slug === "new") {
    if (!admin) redirect("/lab/login?next=/lab/p/new");
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 font-serif text-4xl">{d.newProject}</h1>
        <ProjectForm d={d} />
      </div>
    );
  }

  const p = await getProject(slug);
  if (!p || (!p.is_public && !admin)) notFound();
  const [reports, commands] = await Promise.all([
    listReports({ includePrivate: admin, project: slug, limit: 100 }),
    admin ? listCommands({ project: slug, limit: 30 }) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <Link href="/lab" className="font-mono text-xs text-muted hover:text-fg">
        ← {d.allProjects}
      </Link>
      <header className="rise">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={p.status} />
          {admin ? <VisibilityPill isPublic={p.is_public} labels={d} /> : null}
          <span className="font-mono text-[11px] text-dim">/{p.slug}</span>
        </div>
        <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">{pick(lang, p.title, p.title_vi)}</h1>
        <p className="mt-4 max-w-3xl leading-relaxed text-muted">{pick(lang, p.summary, p.summary_vi)}</p>
        <div className="mt-5 flex flex-wrap gap-1.5">
          {p.tags.map((tag) => (
            <span key={tag} className="rounded-md border border-line px-2 py-0.5 font-mono text-xs text-muted">
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {p.demo_url ? (
            <a href={p.demo_url} target="_blank" rel="noopener noreferrer" className="btn btn-lime">
              {d.viewDemo} ↗
            </a>
          ) : null}
          {p.repo_url ? (
            <a href={p.repo_url} target="_blank" rel="noopener noreferrer" className="btn">
              {d.viewRepo} ↗
            </a>
          ) : null}
          {admin ? (
            <form action={toggleProjectPublic.bind(null, p.slug)}>
              <button className="btn">{p.is_public ? d.makePrivate : d.makePublic}</button>
            </form>
          ) : null}
        </div>
        <div className="mt-6 max-w-md">
          <div className="label mb-2">{d.progress}</div>
          <Progress value={p.progress} />
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section>
          <h2 className="label mb-2">
            {d.reports} · {reports.length}
          </h2>
          <div className="card px-5">
            {reports.length ? (
              reports.map((r) => <ReportRow key={r.id} r={r} lang={lang} admin={admin} d={d} />)
            ) : (
              <p className="py-8 text-center text-sm text-dim">{d.noReports}</p>
            )}
          </div>
        </section>
        {admin ? (
          <aside className="flex flex-col gap-6">
            <section>
              <h2 className="label mb-2">{d.nextStep}</h2>
              <div className="card flex flex-col gap-4 p-4">
                <CommandForm d={d} project={p.slug} />
                <CommandList commands={commands} lang={lang} d={d} admin={admin} />
              </div>
            </section>
            <details className="card p-4">
              <summary className="label cursor-pointer">Edit project</summary>
              <div className="mt-4">
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
  const field = "flex flex-col gap-1.5";
  return (
    <form action={saveProject} className="flex flex-col gap-4">
      <div className={field}>
        <label className="label">slug</label>
        <input name="slug" required defaultValue={p?.slug} readOnly={Boolean(p)} className="input font-mono" placeholder="my-analysis" />
      </div>
      <div className={field}>
        <label className="label">Title (EN)</label>
        <input name="title" required defaultValue={p?.title} className="input" />
      </div>
      <div className={field}>
        <label className="label">Tiêu đề (VI)</label>
        <input name="title_vi" defaultValue={p?.title_vi ?? ""} className="input" />
      </div>
      <div className={field}>
        <label className="label">Summary (EN)</label>
        <textarea name="summary" rows={3} defaultValue={p?.summary} className="input" />
      </div>
      <div className={field}>
        <label className="label">Tóm tắt (VI)</label>
        <textarea name="summary_vi" rows={3} defaultValue={p?.summary_vi ?? ""} className="input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className={field}>
          <label className="label">{d.status}</label>
          <select name="status" defaultValue={p?.status ?? "active"} className="input">
            {["active", "paused", "done", "idea"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className={field}>
          <label className="label">{d.progress} %</label>
          <input name="progress" type="number" min={0} max={100} defaultValue={p?.progress ?? 0} className="input" />
        </div>
      </div>
      <div className={field}>
        <label className="label">Tags (comma separated)</label>
        <input name="tags" defaultValue={p?.tags.join(", ")} className="input" />
      </div>
      <div className={field}>
        <label className="label">Demo URL</label>
        <input name="demo_url" type="url" defaultValue={p?.demo_url ?? ""} className="input" />
      </div>
      <div className={field}>
        <label className="label">Repo URL</label>
        <input name="repo_url" type="url" defaultValue={p?.repo_url ?? ""} className="input" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_public" defaultChecked={p?.is_public ?? false} className="accent-[var(--lime)]" />
        {d.public}
      </label>
      <button className="btn btn-lime justify-center">{d.save}</button>
    </form>
  );
}
