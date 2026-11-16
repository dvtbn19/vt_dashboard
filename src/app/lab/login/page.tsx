import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { getLang, t } from "@/lib/i18n";
import { LoginForm } from "@/components/LoginForm";

export default async function Login({ searchParams }: PageProps<"/lab/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "/lab";
  if (await isAdmin()) redirect(next);
  const lang = await getLang();
  const d = t(lang);
  return (
    <div className="mx-auto max-w-[400px] py-6">
      <h1 className="text-[33px] font-bold tracking-[-0.02em]">{d.login}</h1>
      <p className="mb-8 mt-2 text-pencil">
        {lang === "vi" ? "Đăng nhập để xem mục riêng tư và giao việc cho agent." : "Sign in to see private work and give agents their next task."}
      </p>
      <LoginForm next={next} labels={d} />
    </div>
  );
}
