import { redirect } from "next/navigation";
import { listCommands, listProjects } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { getLang, t } from "@/lib/i18n";
import { CommandList } from "@/components/LabParts";
import { queueCommand } from "@/app/actions";

export default async function Inbox() {
  if (!(await isAdmin())) redirect("/lab/login?next=/lab/inbox");
  const lang = await getLang();
  const d = t(lang);
  const [open, closed, projects] = await Promise.all([
    listCommands({ status: "open", limit: 100 }),
    listCommands({ status: "done", limit: 30 }),
    listProjects({ includePrivate: true }),
  ]);
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-serif text-4xl">{d.inbox}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          {lang === "vi"
            ? "Lệnh ở đây được các agent lấy về qua API (GET /api/lab/commands). Agent nhận lệnh → làm → đăng báo cáo kèm command_id → lệnh tự chuyển sang done."
            : "Agents pick these up via the API (GET /api/lab/commands). Agent claims → works → posts a report with command_id → command flips to done."}
        </p>
      </header>
      <form action={queueCommand} className="card flex flex-col gap-3 p-4">
        <textarea name="body" required rows={3} placeholder={d.nextStepHint} className="input" />
        <div className="flex flex-wrap gap-2">
          <select name="project" className="input max-w-[14rem]" defaultValue="">
            <option value="">— {d.allProjects} —</option>
            {projects.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.slug}
              </option>
            ))}
          </select>
          <input name="agent" placeholder={d.agentOptional} className="input max-w-[12rem] font-mono text-sm" />
          <button className="btn btn-lime ml-auto">{d.send} ↵</button>
        </div>
      </form>
      <section>
        <h2 className="label mb-2">
          {d.openCommands} · {open.length}
        </h2>
        <CommandList commands={open} lang={lang} d={d} admin />
      </section>
      <section>
        <h2 className="label mb-2">Done</h2>
        <CommandList commands={closed} lang={lang} d={d} admin />
      </section>
    </div>
  );
}
