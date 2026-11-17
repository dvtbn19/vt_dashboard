import { notFound } from "next/navigation";
import { getCommand, getProject, getReport, listCommands } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { clock, dayLabel, getLang, pick, t, timeAgo } from "@/lib/i18n";
import { Blocks, Markdown } from "@/components/Blocks";
import { AgentAvatar, CommandList } from "@/components/LabParts";
import { ComposeButton } from "@/components/LabChrome";
import { StatusPill } from "@/components/Status";
import { IconGlobe, IconLock, IconReply } from "@/components/Icons";
import { PageHead } from "@/components/PageHead";
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
  const pname = p ? pick(lang, p.title, p.title_vi).split(" — ")[0] : r.project_slug;

  return (
    <article className="mx-auto flex max-w-[980px] flex-col gap-6">
      <div>
        <PageHead back={{ href: `/lab/p/${r.project_slug}`, label: pname }} title={r.title}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] text-pencil">
            <StatusPill status={r.status} lang={lang} />
            {r.agent ? (
              <span className="inline-flex items-center gap-2 font-medium text-ink">
                <AgentAvatar name={r.agent} size={24} />
                {r.agent}
              </span>
            ) : null}
            {r.kind ? <span className="rounded-full bg-raised px-2.5 py-0.5 text-[13px] font-medium">{r.kind}</span> : null}
            <time dateTime={r.created_at} className="tnum">
              {dayLabel(r.created_at, lang)}, {clock(r.created_at)}
            </time>
            {r.updated_at !== r.created_at ? (
              <span>
                {d.updated} {timeAgo(r.updated_at, lang)}
              </span>
            ) : null}
            {admin ? (
              <span className="inline-flex items-center gap-1">
                {r.is_public ? <IconGlobe size={14} /> : <IconLock size={14} />}
                {r.is_public ? d.public : d.private}
              </span>
            ) : null}
          </div>
        </PageHead>

        {parent || r.summary ? (
          <div className="panel flex flex-col gap-4 p-5">
            {parent ? (
              <p className="asked">
                <IconReply size={17} />
                <span>
                  <span className="font-semibold text-ink">{vi ? "Bạn đã giao: " : "You asked: "}</span>
                  {parent.body}
                </span>
              </p>
            ) : null}
            {r.summary ? <Markdown content={r.summary} className="text-[17px] leading-relaxed sm:text-[18px]" /> : null}
          </div>
        ) : null}

        {admin ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <ComposeButton className="btn btn-primary" project={r.project_slug} reportId={r.id} agent={r.agent} context={r.title}>
              <IconReply size={18} />
              {vi ? "Giao việc tiếp" : "Follow up"}
            </ComposeButton>
            <form action={toggleReportPublic.bind(null, r.id)}>
              <button className="btn">{r.is_public ? d.makePrivate : d.makePublic}</button>
            </form>
          </div>
        ) : null}
      </div>

      {r.blocks.length ? (
        <Blocks blocks={r.blocks} />
      ) : (
        <p className="panel border-dashed p-6 text-pencil">{vi ? "Báo cáo này chưa có nội dung." : "This report has no content yet."}</p>
      )}

      {admin ? (
        <section aria-labelledby="fu-h" className="border-t border-rule pt-6">
          <h2 id="fu-h" className="mb-3 text-[17px] font-semibold">
            {vi ? "Lệnh tiếp theo từ báo cáo này" : "Follow-ups from this report"}
          </h2>
          <CommandList commands={followups} lang={lang} d={d} admin={admin} />
        </section>
      ) : null}
    </article>
  );
}
