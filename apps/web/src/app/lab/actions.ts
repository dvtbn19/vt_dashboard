"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { api, ApiError, ApiUnavailable, publicApi } from "@/lib/api";
import { authMode, LOCAL_TOKEN_COOKIE } from "@/lib/config";
import { supabaseServer } from "@/lib/supabase";
import type { Credential, Project } from "@/lib/types";

export type FormState = { error?: string; ok?: string; token?: string } | undefined;

function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.detail;
  if (err instanceof ApiUnavailable) return "The lab API is not reachable. Check that it is running.";
  return "Something went wrong. Try again.";
}

// ------------------------------------------------------------------ auth

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  if (!email || !password) return { error: "Enter your e-mail and password." };
  if (authMode() === "local") {
    try {
      const res = await publicApi<{ access_token: string; expires_in: number }>("/v1/auth/local-login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        headers: { "Content-Type": "application/json" },
      });
      (await cookies()).set(LOCAL_TOKEN_COOKIE, res.access_token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: res.expires_in,
      });
    } catch (err) {
      return { error: err instanceof ApiError && err.status === 401 ? "Wrong e-mail or password." : errorText(err) };
    }
  } else {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
  }
  redirect("/lab");
}

export async function signOut() {
  if (authMode() === "local") {
    (await cookies()).delete(LOCAL_TOKEN_COOKIE);
  } else {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  }
  redirect("/lab/login");
}

// ------------------------------------------------------------------ projects

function projectBody(form: FormData, includeSlug: boolean) {
  const tags = String(form.get("tags") || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const body: Record<string, unknown> = {
    name: String(form.get("name") || "").trim(),
    summary: String(form.get("summary") || "").trim(),
    description: String(form.get("description") || ""),
    category: String(form.get("category") || "eda"),
    status: String(form.get("status") || "active"),
    visibility: form.get("visibility") === "public" ? "public" : "private",
    tags,
    repo_url: String(form.get("repo_url") || "").trim() || null,
  };
  const slug = String(form.get("slug") || "").trim();
  if (includeSlug && slug) body.slug = slug;
  return body;
}

export async function createProject(_: FormState, form: FormData): Promise<FormState> {
  let project: Project;
  try {
    project = await api<Project>("/v1/projects", { method: "POST", body: JSON.stringify(projectBody(form, true)) });
  } catch (err) {
    return { error: errorText(err) };
  }
  revalidatePath("/lab", "layout");
  redirect(`/lab/projects/${project.id}`);
}

export async function updateProject(id: string, _: FormState, form: FormData): Promise<FormState> {
  try {
    await api<Project>(`/v1/projects/${id}`, { method: "PATCH", body: JSON.stringify(projectBody(form, false)) });
  } catch (err) {
    return { error: errorText(err) };
  }
  revalidatePath("/lab", "layout");
  revalidatePath("/projects");
  redirect(`/lab/projects/${id}`);
}

// ------------------------------------------------------------------ agent tokens

export async function createToken(_: FormState, form: FormData): Promise<FormState> {
  const projects = form.getAll("project_ids").map(String);
  const scopes = form.getAll("scopes").map(String);
  const days = Number(form.get("expires_in_days") || 90);
  if (projects.length === 0) return { error: "Choose at least one project, or all projects." };
  if (scopes.length === 0) return { error: "Choose at least one permission." };
  try {
    const cred = await api<Credential & { token: string }>("/v1/credentials", {
      method: "POST",
      body: JSON.stringify({
        name: String(form.get("name") || "").trim() || "agent",
        project_ids: projects.includes("*") ? ["*"] : projects,
        scopes,
        expires_in_days: days,
      }),
    });
    revalidatePath("/lab/settings");
    return { ok: `Created “${cred.name}”.`, token: cred.token };
  } catch (err) {
    return { error: errorText(err) };
  }
}

export async function revokeToken(id: string) {
  await api(`/v1/credentials/${id}/revoke`, { method: "POST" });
  revalidatePath("/lab/settings");
}
