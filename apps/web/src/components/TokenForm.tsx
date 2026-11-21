"use client";

import { ActionForm, FormError, Submit, TokenReveal } from "./forms";
import type { FormState } from "@/app/lab/actions";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

const SCOPES = [
  { v: "read", l: "Read projects and runs" },
  { v: "runs:write", l: "Create runs and log metrics" },
  { v: "artifacts:write", l: "Upload files" },
  { v: "notes:write", l: "Create and edit working notes" },
  { v: "queries:write", l: "Save SQL queries (agents can never run SQL)" },
];

export function TokenForm({ action, projects }: { action: Action; projects: { id: string; name: string }[] }) {
  return (
    <ActionForm action={action} className="space-y-5">
      {(state) => (
        <>
          {state?.token && <TokenReveal token={state.token} />}
          <FormError state={state} />
          <div>
            <label className="label" htmlFor="tname">
              Name
            </label>
            <input className="field" id="tname" name="name" required maxLength={120} placeholder="laptop-eda-scripts" />
          </div>
          <fieldset>
            <legend className="label">Projects it can publish to</legend>
            <div className="space-y-1">
              {projects.map((p) => (
                <label key={p.id} className="flex min-h-10 items-center gap-3">
                  <input type="checkbox" name="project_ids" value={p.id} className="h-4 w-4 accent-(--accent)" />
                  {p.name}
                </label>
              ))}
              <label className="flex min-h-10 items-center gap-3 text-muted">
                <input type="checkbox" name="project_ids" value="*" className="h-4 w-4 accent-(--accent)" />
                All my projects, including future ones
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">Permissions</legend>
            {SCOPES.map((s) => (
              <label key={s.v} className="flex min-h-10 items-center gap-3">
                <input type="checkbox" name="scopes" value={s.v} defaultChecked className="h-4 w-4 accent-(--accent)" />
                {s.l}
              </label>
            ))}
          </fieldset>
          <div className="max-w-[220px]">
            <label className="label" htmlFor="days">
              Expires after
            </label>
            <select className="field" id="days" name="expires_in_days" defaultValue="90">
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
            </select>
          </div>
          <Submit pending="Creating…">Create token</Submit>
        </>
      )}
    </ActionForm>
  );
}
