import { redirect } from "next/navigation";
import { listCommands, listProjects } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { getLang, t } from "@/lib/i18n";
import { CommandForm, CommandList } from "@/components/LabParts";

export default async function Inbox() {
  if (!(await isAdmin())) redirect("/lab/login?next=/lab/inbox");
  const lang = await getLang();
  const d = t(lang);
  const vi = lang === "vi";
  const [open, closed, projects] = await Promise.all([
    listCommands({ status: "open", limit: 100 }),
    listCommands({ status: "done", limit: 30 }),
    listProjects({ includePrivate: true }),
  ]);
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:grid-rows-[auto_1fr] lg:gap-x-14">
      {/* Phones and tablets: heading, then the form, then the lists. Desktop: form in the right column. */}
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">
        <h1 className="text-[33px] font-bold tracking-[-0.02em] sm:text-[41px]">{d.inbox}</h1>
        <p className="mt-3 max-w-[60ch] text-pencil">
          {vi
            ? "Agent lấy lệnh ở đây, làm xong thì đăng báo cáo kèm mã lệnh, và lệnh tự chuyển sang xong."
            : "Agents pick up commands from here. When an agent posts a report for a command, the command is marked done and linked to the result."}
        </p>
      </div>
      <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-2">
        <div className="sheet p-4 sm:p-5 lg:sticky lg:top-6">
          <CommandForm d={d} projects={projects} id="inbox" />
        </div>
      </aside>
      <div className="min-w-0 lg:col-start-1 lg:row-start-2">
        <section aria-labelledby="open-h">
          <h2 id="open-h" className="border-b border-ink pb-2 text-[17px] font-semibold">
            {vi ? `Đang chờ (${open.length})` : `Waiting (${open.length})`}
          </h2>
          <CommandList commands={open} lang={lang} d={d} admin />
        </section>
        <section aria-labelledby="done-h" className="mt-10">
          <h2 id="done-h" className="border-b border-ink pb-2 text-[17px] font-semibold">
            {vi ? "Đã xong gần đây" : "Recently done"}
          </h2>
          <CommandList commands={closed} lang={lang} d={d} admin />
        </section>
      </div>
    </div>
  );
}
