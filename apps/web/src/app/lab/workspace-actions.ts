"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api, ApiError, ApiUnavailable } from "@/lib/api";
import { NOTE_TEMPLATES, type NoteTemplate } from "@/lib/templates";
import type { ChartSpec, Note, NoteLink, QueryResult, SavedQuery } from "@/lib/types";

export type SaveResult =
  | { ok: true; version: number; updated_at: string; last_edited_by: string; id: string }
  | { ok: false; error: string; conflict?: { current_version: number } };

export type RunResult = { ok: true; result: QueryResult } | { ok: false; error: string };

function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.detail;
  if (err instanceof ApiUnavailable) return "The lab API is not reachable. Try again in a moment.";
  return "Something went wrong. Try again.";
}

function failure(err: unknown): { ok: false; error: string; conflict?: { current_version: number } } {
  if (err instanceof ApiError && err.status === 409) {
    const detail = (err.body as { detail?: { current_version?: unknown } } | undefined)?.detail;
    if (detail && typeof detail.current_version === "number") {
      return { ok: false, error: err.detail, conflict: { current_version: detail.current_version } };
    }
  }
  return { ok: false, error: errorText(err) };
}

function isRedirect(err: unknown) {
  const digest = (err as { digest?: unknown })?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

// ------------------------------------------------------------------ notes

export async function createNote(projectId: string, form: FormData) {
  const key = String(form.get("template") || "blank") as NoteTemplate;
  const tpl = NOTE_TEMPLATES[key] ?? NOTE_TEMPLATES.blank;
  const note = await api<Note>(`/v1/projects/${projectId}/notes`, {
    method: "POST",
    body: JSON.stringify({ title: tpl.title, body: tpl.body }),
  });
  revalidatePath(`/lab/projects/${projectId}`);
  // Open it in the workspace (SQL on one side, the note on the other), keeping the open query.
  const q = String(form.get("query") || "");
  redirect(`/lab/projects/${projectId}/workspace?note=${note.id}${q ? `&query=${encodeURIComponent(q)}` : ""}`);
}

export async function saveNote(
  id: string,
  baseVersion: number,
  title: string,
  body: string,
  links?: NoteLink[],
): Promise<SaveResult> {
  try {
    const n = await api<Note>(`/v1/notes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ base_version: baseVersion, title: title.trim() || "Untitled note", body, links }),
    });
    revalidatePath(`/lab/projects/${n.project_id}`);
    return { ok: true, id: n.id, version: n.version, updated_at: n.updated_at, last_edited_by: n.last_edited_by };
  } catch (err) {
    if (isRedirect(err)) throw err;
    return failure(err);
  }
}

export async function deleteNote(id: string, projectId: string) {
  await api(`/v1/notes/${id}`, { method: "DELETE" });
  revalidatePath(`/lab/projects/${projectId}`);
  redirect(`/lab/projects/${projectId}`);
}

// ------------------------------------------------------------------ saved queries

type QueryFields = { name: string; description: string; sql: string; chart: ChartSpec | null };

export async function saveQuery(
  projectId: string,
  id: string | null,
  baseVersion: number | null,
  fields: QueryFields,
): Promise<SaveResult> {
  const body = { ...fields, name: fields.name.trim() || "Untitled query" };
  try {
    const q = id
      ? await api<SavedQuery>(`/v1/queries/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ ...body, base_version: baseVersion }),
        })
      : await api<SavedQuery>(`/v1/projects/${projectId}/queries`, { method: "POST", body: JSON.stringify(body) });
    revalidatePath(`/lab/projects/${projectId}`);
    revalidatePath(`/lab/projects/${projectId}/dashboard`);
    revalidatePath(`/lab/projects/${projectId}/workspace`);
    return { ok: true, id: q.id, version: q.version, updated_at: q.updated_at, last_edited_by: q.last_edited_by };
  } catch (err) {
    if (isRedirect(err)) throw err;
    return failure(err);
  }
}

export async function deleteQuery(id: string, projectId: string) {
  await api(`/v1/queries/${id}`, { method: "DELETE" });
  revalidatePath(`/lab/projects/${projectId}`);
  redirect(`/lab/projects/${projectId}`);
}

export async function runSql(sql: string, maxRows = 1000): Promise<RunResult> {
  try {
    const result = await api<QueryResult>("/v1/queries/run", {
      method: "POST",
      body: JSON.stringify({ sql, max_rows: maxRows }),
      timeoutMs: 45000,
    });
    return { ok: true, result };
  } catch (err) {
    if (isRedirect(err)) throw err;
    return { ok: false, error: errorText(err) };
  }
}

export async function runSavedQuery(id: string, maxRows = 1000): Promise<RunResult> {
  try {
    const result = await api<QueryResult>(`/v1/queries/${id}/run?max_rows=${maxRows}`, {
      method: "POST",
      timeoutMs: 45000,
    });
    return { ok: true, result };
  } catch (err) {
    if (isRedirect(err)) throw err;
    return { ok: false, error: errorText(err) };
  }
}
