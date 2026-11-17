import Link from "next/link";
import { redirect } from "next/navigation";
import { listCommands } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { getLang, t } from "@/lib/i18n";
import { CommandList } from "@/components/LabParts";
import { ComposeButton } from "@/components/LabChrome";
import { IconPlus } from "@/components/Icons";
import { PageHead } from "@/components/PageHead";

const VIEWS = ["open", "done", "cancelled"] as const;
type View = (typeof VIEWS)[number];

export default async function Inbox({ searchParams }: PageProps<"/lab/inbox">) {
  if (!(await isAdmin())) redirect("/lab/login?next=/lab/inbox");
  const sp = await searchParams;
  const view: View = VIEWS.includes(sp.view as View) ? (sp.view as View) : "open";
  const lang = await getLang();
  const d = t(lang);
  const vi = lang === "vi";

  const all = await listCommands({ limit: 300 });
  const groups: Record<View, typeof all> = {
    open: all.filter((c) => c.status === "pending" || c.status === "claimed"),
    done: all.filter((c) => c.status === "done"),
    cancelled: all.filter((c) => c.status === "cancelled"),
  };
  const words: Record<View, string> = vi
    ? { open: "Đang chờ", done: "Đã xong", cancelled: "Đã huỷ" }
    : { open: "Waiting", done: "Done", cancelled: "Cancelled" };

  return (
    <div className="mx-auto max-w-[760px]">
      <PageHead
        title={d.inbox}
        desc={
          vi
            ? "Agent lấy lệnh ở đây. Khi agent đăng báo cáo kèm mã lệnh, lệnh tự chuyển sang xong và nối với kết quả."
            : "Agents pick up commands here. When an agent posts a report for a command, it's marked done and linked to the result."
        }
        actions={
          <ComposeButton className="btn btn-primary hidden lg:inline-flex">
            <IconPlus size={18} />
            {d.newTask}
          </ComposeButton>
        }
      />

      <nav aria-label={d.status} className="chips mb-5">
        {VIEWS.map((v) => (
          <Link key={v} href={v === "open" ? "/lab/inbox" : `/lab/inbox?view=${v}`} aria-current={view === v ? "true" : undefined} className="chip">
            {words[v]} <span className="count">{groups[v].length}</span>
          </Link>
        ))}
      </nav>

      <CommandList commands={groups[view]} lang={lang} d={d} admin />

      <ComposeButton className="btn mt-5 w-full border-dashed lg:hidden">
        <IconPlus size={18} />
        {d.newTask}
      </ComposeButton>
    </div>
  );
}
