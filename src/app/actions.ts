"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { checkPassword, isAdmin, makeSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { createCommand, getReport, updateCommand, updateReport, upsertProject, getProject, type CommandStatus } from "@/lib/db";

export async function setLang(lang: "en" | "vi", path: string) {
  (await cookies()).set("lang", lang, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
  revalidatePath(path);
}

export async function login(_prev: { error?: string } | undefined, form: FormData) {
  const pw = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/lab");
  if (!process.env.ADMIN_PASSWORD) return { error: "Sign-in isn't set up yet. Add ADMIN_PASSWORD in the Vercel project settings, then redeploy." };
  if (!checkPassword(pw)) return { error: "That password doesn't match. Check it and try again." };
  (await cookies()).set(SESSION_COOKIE, makeSessionToken(), sessionCookieOptions);
  redirect(next.startsWith("/") ? next : "/lab");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/lab");
}

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Not authorized");
}

export async function queueCommand(form: FormData) {
  await requireAdmin();
  const text = String(form.get("body") ?? "").trim();
  if (!text) return;
  const reportId = String(form.get("report_id") ?? "") || null;
  const project = String(form.get("project") ?? "") || null;
  const agent = String(form.get("agent") ?? "").trim() || null;
  await createCommand({ body: text, report_id: reportId, project_slug: project, agent, created_by: "owner" });
  revalidatePath("/lab", "layout");
}

export async function setCommandStatus(id: string, status: CommandStatus) {
  await requireAdmin();
  await updateCommand(id, { status });
  revalidatePath("/lab", "layout");
}

export async function toggleReportPublic(id: string) {
  await requireAdmin();
  const r = await getReport(id);
  if (!r) return;
  await updateReport(id, { is_public: !r.is_public });
  revalidatePath("/lab", "layout");
}

export async function toggleProjectPublic(slug: string) {
  await requireAdmin();
  const p = await getProject(slug);
  if (!p) return;
  await upsertProject({ slug, is_public: !p.is_public });
  revalidatePath("/lab", "layout");
  revalidatePath("/");
}

export async function saveProject(form: FormData) {
  await requireAdmin();
  const slug = String(form.get("slug") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) return;
  const s = (k: string) => {
    const v = form.get(k);
    return v === null ? undefined : String(v).trim() || null;
  };
  await upsertProject({
    slug,
    title: s("title") ?? slug,
    title_vi: s("title_vi"),
    summary: s("summary") ?? "",
    summary_vi: s("summary_vi"),
    status: (s("status") as "active") ?? "active",
    tags: (s("tags") ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    repo_url: s("repo_url"),
    demo_url: s("demo_url"),
    progress: Number(s("progress") ?? 0),
    is_public: form.get("is_public") === "on",
  });
  revalidatePath("/lab", "layout");
  redirect(`/lab/p/${slug}`);
}
