"use client";

import { ActionForm, FormError, Submit } from "./forms";
import type { FormState } from "@/app/lab/actions";
import { CATEGORIES, PROJECT_STATUSES, type Project } from "@/lib/types";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

export function ProjectForm({ action, project }: { action: Action; project?: Project }) {
  return (
    <ActionForm action={action} className="space-y-5">
      {(state) => (
        <>
          <FormError state={state} />
          <div>
            <label className="label" htmlFor="name">
              Name
            </label>
            <input className="field" id="name" name="name" required maxLength={200} defaultValue={project?.name} />
          </div>
          {!project && (
            <div>
              <label className="label" htmlFor="slug">
                Slug <span className="font-normal text-muted">(optional)</span>
              </label>
              <input className="field" id="slug" name="slug" maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="ecommerce-sales-analysis" aria-describedby="slug-hint" />
              <p id="slug-hint" className="hint mt-1">
                Lowercase letters, digits and hyphens. Scripts find the project by this. Generated from the name if empty; cannot be changed later.
              </p>
            </div>
          )}
          <div>
            <label className="label" htmlFor="summary">
              One-line summary
            </label>
            <input className="field" id="summary" name="summary" maxLength={500} defaultValue={project?.summary} />
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="category">
                Type of work
              </label>
              <select className="field" id="category" name="category" defaultValue={project?.category ?? "eda"}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="status">
                Status
              </label>
              <select className="field capitalize" id="status" name="status" defaultValue={project?.status ?? "active"}>
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="visibility">
                Visibility
              </label>
              <select className="field" id="visibility" name="visibility" defaultValue={project?.visibility ?? "private"} aria-describedby="vis-hint">
                <option value="private">Private</option>
                <option value="public">Public on portfolio</option>
              </select>
            </div>
          </div>
          <p id="vis-hint" className="hint -mt-2">
            Public shows the name, summary, tags and write-up on the portfolio. Runs, metrics and files always stay private.
          </p>
          <div>
            <label className="label" htmlFor="tags">
              Tags <span className="font-normal text-muted">(comma separated)</span>
            </label>
            <input className="field" id="tags" name="tags" defaultValue={project?.tags.join(", ")} />
          </div>
          <div>
            <label className="label" htmlFor="repo_url">
              Repository URL <span className="font-normal text-muted">(optional)</span>
            </label>
            <input className="field" id="repo_url" name="repo_url" type="url" defaultValue={project?.repo_url ?? ""} placeholder="https://github.com/…" />
          </div>
          <div>
            <label className="label" htmlFor="description">
              Write-up <span className="font-normal text-muted">(Markdown)</span>
            </label>
            <textarea className="field min-h-48 font-mono text-[14px]" id="description" name="description" defaultValue={project?.description} />
          </div>
          <Submit>{project ? "Save changes" : "Create project"}</Submit>
        </>
      )}
    </ActionForm>
  );
}
