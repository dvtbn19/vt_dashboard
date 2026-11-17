import { createToken, revokeToken } from "../../actions";
import { ProblemState } from "@/components/ProblemState";
import { Chip } from "@/components/Status";
import { TokenForm } from "@/components/TokenForm";
import { api } from "@/lib/api";
import { attempt } from "@/lib/attempt";
import { ago, fmtDate } from "@/lib/format";
import type { Credential, ProjectListItem } from "@/lib/types";

export const metadata = { title: "Agent tokens" };

function state(c: Credential): { label: string; tone: "plain" | "accent" | "warn" } {
  if (c.revoked_at) return { label: "Revoked", tone: "plain" };
  if (c.expires_at && new Date(c.expires_at) < new Date()) return { label: "Expired", tone: "warn" };
  return { label: "Active", tone: "accent" };
}

export default async function SettingsPage() {
  const res = await attempt(() => Promise.all([api<Credential[]>("/v1/credentials"), api<ProjectListItem[]>("/v1/projects")]));
  if (!res.ok) return <ProblemState problem={res.problem} />;
  const [creds, projects] = res.data;
  const names = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  return (
    <>
      <h1 className="text-[28px] font-bold tracking-tight">Agent tokens</h1>
      <p className="max-w-[70ch] text-muted">
        Scripts and agents publish with a token instead of your password. Each token is limited to the projects and
        permissions you choose, can be revoked at any time, and is shown only once.
      </p>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section>
          <h2 className="mb-3 text-[19px] font-bold">Your tokens</h2>
          {creds.length === 0 ? (
            <p className="text-muted">No tokens yet. Create one to let a script publish results.</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {creds.map((c) => {
                const s = state(c);
                const live = s.label === "Active";
                return (
                  <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {c.name} <Chip tone={s.tone}>{s.label}</Chip>
                      </p>
                      <p className="mt-0.5 font-mono text-[13px] text-muted">{c.token_prefix}…</p>
                      <p className="mt-1 text-[13.5px] text-muted">
                        {c.project_ids.includes("*") ? "All projects" : c.project_ids.map((id) => names[id] ?? "deleted project").join(", ")}
                        {" · "}
                        {c.scopes.join(", ")}
                      </p>
                      <p className="text-[13.5px] text-muted">
                        Last used {ago(c.last_used_at)} · {c.revoked_at ? `revoked ${fmtDate(c.revoked_at)}` : `expires ${fmtDate(c.expires_at)}`}
                      </p>
                    </div>
                    {live && (
                      <form action={revokeToken.bind(null, c.id)}>
                        <button type="submit" className="btn btn-quiet min-h-10 px-3 text-[14px] text-fail">
                          Revoke
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="sheet h-fit p-5">
          <h2 className="mb-4 text-[19px] font-bold">New token</h2>
          {projects.length === 0 ? (
            <p className="text-muted">Create a project first; tokens are scoped to projects.</p>
          ) : (
            <TokenForm action={createToken} projects={projects.map((p) => ({ id: p.id, name: p.name }))} />
          )}
        </section>
      </div>
    </>
  );
}
