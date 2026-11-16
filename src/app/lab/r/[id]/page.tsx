import Link from "next/link";
import { notFound } from "next/navigation";
import { getCommand, getProject, getReport, listCommands } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { getLang, pick, t, timeAgo } from "@/lib/i18n";
import { Blocks, Markdown } from "@/components/Blocks";
import { CommandForm, CommandList } from "@/components/LabParts";
import { StatusPill, VisibilityPill } from "@/components/Status";
import { toggleReportPublic } from "@/app/actions";

export default async function ReportPage({ params }: PageProps<"/lab/r/[id]">) {
  const { id } = await params;
  const [admin, lang] = await Promise.all([isAdmin(), getLang()]);
  const d = t(lang);
  const r = await getReport(id);
  if (!r) notFound();
  const p = await getProject(r.project_slug);
  if (!admin && (!r.is_public || !p?.is_public)) notFound();

  const [parent, followups] = await Promise.all([
    r.parent_command_id && admin ? getCommand(r.parent_command_id) : Promise.resolve(null),
    admin ? listCommands({ report: r.id, limit: 20 }) : Promise.resolve([]),
  ]);

  return (
    <article className="flex flex-col gap-6">
      <Link href={`/lab/p/${r.project_slug}`} className="font-mono text-xs text-muted hover:text-fg">
        ← {p ? pick(lang, p.title, p.title_vi) : r.project_slug}
      </Link>

      <header className="rise">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-dim">
          <StatusPill status={r.status} />
          {r.kind ? <span className="rounded border border-line px-1.5 py-0.5">{r.kind}</span> : null}
          {admin ? <VisibilityPill isPublic={r.is_public} labels={d} /> : null}
          {r.agent ? <span className="text-violet">@{r.agent}</span> : null}
          <span title={r.created_at}>{timeAgo(r.created_at, lang)}</span>
          {r.updated_at !== r.created_at ? (
            <span>
              · {d.updated} {timeAgo(r.updated_at, lang)}
            </span>
          ) : null}
        </div>
        <h1 className="mt-3 font-serif text-3xl leading-tight sm:text-5xl">{r.title}</h1>
        {r.summary ? (
          <div className="mt-4 max-w-3xl text-muted">
            <Markdown content={r.summary} />
          </div>
        ) : null}
        {admin ? (
          <form action={toggleReportPublic.bind(null, r.id)} className="mt-4">
            <button className="btn">{r.is_public ? d.makePrivate : d.makePublic}</button>
          </form>
        ) : null}
      </header>

      {parent ? (
        <div className="rounded-xl border border-violet/30 bg-violet/5 p-4 text-sm">
          <div className="label mb-1 text-violet">{lang === "vi" ? "Được tạo từ lệnh" : "Triggered by command"}</div>
          <p className="whitespace-pre-wrap">{parent.body}</p>
        </div>
      ) : null}

      <Blocks blocks={r.blocks} />

      {admin ? (
        <section className="mt-4">
          <h2 className="label mb-2">{d.nextStep}</h2>
          <div className="card flex flex-col gap-4 p-4">
            <CommandForm d={d} reportId={r.id} project={r.project_slug} agent={r.agent} />
            <CommandList commands={followups} lang={lang} d={d} admin={admin} />
          </div>
        </section>
      ) : null}
    </article>
  );
}
