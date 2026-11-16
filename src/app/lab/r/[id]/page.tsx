import Link from "next/link";
import { notFound } from "next/navigation";
import { getCommand, getProject, getReport, listCommands } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { clock, dayLabel, getLang, pick, t, timeAgo } from "@/lib/i18n";
import { Blocks, Markdown } from "@/components/Blocks";
import { CommandForm, CommandList } from "@/components/LabParts";
import { StatusPill } from "@/components/Status";
import { toggleReportPublic } from "@/app/actions";

export default async function ReportPage({ params }: PageProps<"/lab/r/[id]">) {
  const { id } = await params;
  const [admin, lang] = await Promise.all([isAdmin(), getLang()]);
  const d = t(lang);
  const vi = lang === "vi";
  const r = await getReport(id);
  if (!r) notFound();
  const p = await getProject(r.project_slug);
  if (!admin && (!r.is_public || !p?.is_public)) notFound();

  const [parent, followups] = await Promise.all([
    r.parent_command_id && admin ? getCommand(r.parent_command_id) : Promise.resolve(null),
    admin ? listCommands({ report: r.id, limit: 20 }) : Promise.resolve([]),
  ]);

  return (
    <article className="mx-auto flex max-w-[960px] flex-col gap-8">
      <header>
        <Link href={`/lab/p/${r.project_slug}`} className="link text-[15px]">
          {p ? pick(lang, p.title, p.title_vi).split(" — ")[0] : r.project_slug}
        </Link>
        <h1 className="mt-4 max-w-[30ch] text-[33px] font-bold leading-[1.12] tracking-[-0.02em] sm:text-[41px]">{r.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-pencil">
          <StatusPill status={r.status} lang={lang} />
          {r.agent ? <span className="text-signal">{r.agent}</span> : null}
          {r.kind ? <span>{r.kind}</span> : null}
          <time dateTime={r.created_at}>
            {dayLabel(r.created_at, lang)}, {clock(r.created_at)}
          </time>
          {r.updated_at !== r.created_at ? (
            <span>
              {d.updated} {timeAgo(r.updated_at, lang)}
            </span>
          ) : null}
          {admin ? <span>{r.is_public ? d.public : d.private}</span> : null}
        </div>
        {parent ? (
          <p className="note mt-5 max-w-[60ch]">
            {vi ? "Bạn đã giao: " : "You asked: "}
            {parent.body}
          </p>
        ) : null}
        {r.summary ? <Markdown content={r.summary} className="mt-6 text-[19px] leading-relaxed" /> : null}
        {admin ? (
          <form action={toggleReportPublic.bind(null, r.id)} className="mt-6">
            <button className="btn">{r.is_public ? d.makePrivate : d.makePublic}</button>
          </form>
        ) : null}
      </header>

      {r.blocks.length ? (
        <Blocks blocks={r.blocks} />
      ) : (
        <p className="text-pencil">{vi ? "Báo cáo này chưa có nội dung." : "This report has no content yet."}</p>
      )}

      {admin ? (
        <section aria-labelledby="next-h" className="mt-4 grid gap-6 border-t border-ink pt-8 md:grid-cols-[1fr_1fr] md:gap-10">
          <div>
            <h2 id="next-h" className="sr-only">
              {d.nextStep}
            </h2>
            <CommandForm d={d} reportId={r.id} project={r.project_slug} agent={r.agent} id="rep" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold">{vi ? "Lệnh tiếp theo từ báo cáo này" : "Follow-ups from this report"}</h3>
            <CommandList commands={followups} lang={lang} d={d} admin={admin} />
          </div>
        </section>
      ) : null}
    </article>
  );
}
