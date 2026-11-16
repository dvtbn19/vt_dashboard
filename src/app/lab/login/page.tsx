import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { getLang, t } from "@/lib/i18n";
import { LoginForm } from "@/components/LoginForm";

export default async function Login({ searchParams }: PageProps<"/lab/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "/lab";
  if (await isAdmin()) redirect(next);
  const d = t(await getLang());
  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="card p-6">
        <h1 className="mb-6 font-serif text-3xl">{d.login}</h1>
        <LoginForm next={next} labels={d} />
      </div>
    </div>
  );
}
