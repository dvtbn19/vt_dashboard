"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ResultView } from "./ResultView";
import { deleteQuery, runSql, saveQuery } from "@/app/lab/workspace-actions";
import { ago } from "@/lib/format";
import { defaultChart, usableChart } from "@/lib/queryResult";
import { countStatements, pickStatement } from "@/lib/sqlStatements";
import type { ChartSpec, QueryEngine, QueryResult, SavedQuery } from "@/lib/types";

type Props = {
  projectId: string;
  query: SavedQuery | null;
  engine: QueryEngine | null;
  /** Workspace mode: called after a save instead of changing the address to the query page. */
  onSaved?: (q: SavedQuery, isNew: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** Workspace mode: start a new, empty query. */
  onNew?: () => void;
  /** Shown under the description (e.g. which notes use this query). */
  aside?: React.ReactNode;
  compact?: boolean;
};

export function QueryEditor({ projectId, query, engine, onSaved, onDirtyChange, onNew, aside, compact }: Props) {
  const [id, setId] = useState(query?.id ?? null);
  const [version, setVersion] = useState(query?.version ?? null);
  const [name, setName] = useState(query?.name ?? "");
  const [description, setDescription] = useState(query?.description ?? "");
  const [sql, setSql] = useState(query?.sql ?? "-- Read-only. Several statements? Run executes the one at the cursor (or the selection).\nselect current_date as today");
  const [chart, setChart] = useState<ChartSpec | null>(query?.chart ?? null);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [ranLabel, setRanLabel] = useState<string | null>(null);
  const sqlRef = useRef<HTMLTextAreaElement>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [conflictVersion, setConflictVersion] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [snapshot, setSnapshot] = useState(() => JSON.stringify({ name, description, sql, chart }));
  const dirty = JSON.stringify({ name, description, sql, chart }) !== snapshot;
  const canRun = engine?.configured !== false;
  const statements = useMemo(() => countStatements(sql), [sql]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const run = useCallback(async () => {
    if (!sql.trim() || running) return;
    // Run the selection, or the statement under the cursor when the editor holds several.
    const el = sqlRef.current;
    const picked = pickStatement(sql, el?.selectionStart ?? 0, el?.selectionEnd ?? 0);
    if (el && picked.range) el.setSelectionRange(picked.range[0], picked.range[1]);
    setRunning(true);
    setRunError(null);
    setRanLabel(picked.label);
    const res = await runSql(picked.sql, engine?.max_rows ? Math.min(engine.max_rows, 5000) : 1000);
    setRunning(false);
    if (res.ok) {
      setResult(res.result);
      setChart((c) => usableChart(c, res.result) ?? (c ? null : defaultChart(res.result)));
    } else {
      setRunError(res.error);
    }
  }, [sql, running, engine]);

  const save = useCallback(
    async (baseVersion = version, asNew = false) => {
      setSaving(true);
      setSaveMsg(null);
      const sameName = !!query && name.trim() === query.name.trim();
      const fields = { name: asNew && sameName ? `${name.trim()} (copy)` : name, description, sql, chart };
      if (fields.name !== name) setName(fields.name);
      const targetId = asNew ? null : id;
      const res = await saveQuery(projectId, targetId, asNew ? null : baseVersion, fields);
      setSaving(false);
      if (res.ok) {
        setSnapshot(JSON.stringify(fields));
        setVersion(res.version);
        setConflictVersion(null);
        setSaveMsg({ ok: true, text: `Saved · v${res.version} · ${ago(res.updated_at)}` });
        if (onSaved) {
          if (!targetId) setId(res.id);
          onSaved(
            {
              ...(query && !asNew ? query : { project_id: projectId, created_at: res.updated_at }),
              ...fields,
              name: fields.name.trim() || "Untitled query",
              id: res.id,
              version: res.version,
              updated_at: res.updated_at,
              last_edited_by: res.last_edited_by,
            },
            !targetId,
          );
        } else if (!targetId) {
          setId(res.id);
          // Update the address without navigating, so the result and chart on screen stay.
          window.history.replaceState(null, "", `/lab/projects/${projectId}/queries/${res.id}`);
        }
      } else {
        if (res.conflict) setConflictVersion(res.conflict.current_version);
        setSaveMsg({ ok: false, text: res.error });
      }
    },
    [version, name, description, sql, chart, projectId, id, onSaved, query],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "Enter") {
        e.preventDefault();
        void run();
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty || !id) void save();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [run, save, dirty, id]);

  const onSqlKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart: a, selectionEnd: b } = el;
      setSql(sql.slice(0, a) + "  " + sql.slice(b));
      requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2));
    }
  };

  return (
    <div>
      <label htmlFor="query-name" className="hint mb-1 block">
        Query name · click to rename, then Save
      </label>
      <input
        id="query-name"
        aria-label="Query name"
        className={`w-full rounded-md border border-dashed border-line bg-transparent px-2 py-1 font-bold leading-tight tracking-tight outline-none placeholder:text-muted hover:border-muted focus:border-solid focus:border-accent ${compact ? "text-[20px]" : "text-[26px]"}`}
        value={name}
        maxLength={200}
        placeholder="Name this query"
        onChange={(e) => setName(e.target.value)}
      />
      <textarea
        aria-label="Description"
        className="mt-2 w-full resize-y bg-transparent text-[15px] text-muted outline-none placeholder:text-muted/70 focus-visible:outline-2"
        rows={2}
        maxLength={20000}
        value={description}
        placeholder="What does it answer? (optional)"
        onChange={(e) => setDescription(e.target.value)}
      />
      {aside}

      {engine && !engine.configured && (
        <p role="status" className="mt-3 rounded-lg bg-run/10 px-3 py-2 text-[14.5px] text-run">
          Running SQL is not set up yet: the API needs <code className="font-mono">ANALYTICS_DATABASE_URL</code> (a read-only database
          user). You can still write and save queries.
        </p>
      )}

      <label htmlFor="sql" className="label mt-4">
        SQL{" "}
        <span className="hint font-normal">
          · read-only, {engine?.timeout_seconds ?? 20}s limit
          {statements > 1 ? ` · ${statements} statements: Run executes the one at the cursor (or your selection)` : ""}
        </span>
      </label>
      <textarea
        ref={sqlRef}
        id="sql"
        className={`field resize-y font-mono !text-[14px] leading-relaxed ${compact ? "min-h-[200px]" : "min-h-[260px]"}`}
        value={sql}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={onSqlKey}
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="btn" onClick={() => void run()} disabled={running || !canRun} aria-busy={running}>
          {running ? "Running…" : "Run"}
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => void save()} disabled={saving || (!dirty && !!id)}>
          {saving ? "Saving…" : id ? "Save" : "Save query"}
        </button>
        {id && (
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => void save(null, true)}
            disabled={saving}
            title="Save a copy under the name above and keep the original"
          >
            Save as new
          </button>
        )}
        {id && onNew && (
          <button type="button" className="btn btn-quiet" onClick={onNew}>
            + New query
          </button>
        )}
        <span className="hint hidden sm:inline">⌘/Ctrl+Enter to run · ⌘/Ctrl+S to save</span>
        {statements > 1 && (
          <span className="hint w-full">Charts, links and the dashboard use the first statement of a saved query.</span>
        )}
        {saveMsg && (
          <span role="status" className={`text-[13.5px] ${saveMsg.ok ? "text-muted" : "text-fail"}`}>
            {saveMsg.ok && dirty ? "Unsaved changes" : saveMsg.text}
          </span>
        )}
        {!saveMsg && dirty && id && <span className="text-[13.5px] text-muted">Unsaved changes</span>}
      </div>
      {conflictVersion !== null && (
        <div role="alert" className="mt-3 rounded-lg border border-run/50 bg-run/10 p-3 text-[14.5px]">
          <p className="font-semibold text-run">This query was changed elsewhere (now v{conflictVersion}).</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn !min-h-10" onClick={() => void save(conflictVersion)}>
              Keep mine (overwrite)
            </button>
            <a className="btn btn-quiet !min-h-10" href="" target="_blank" rel="noopener">
              Open the latest in a new tab
            </a>
          </div>
        </div>
      )}

      <section className={compact ? "mt-5" : "mt-8"} aria-label="Result">
        {runError && (
          <pre role="alert" className="whitespace-pre-wrap rounded-lg border border-fail/40 bg-fail/8 px-3 py-2 font-mono text-[13.5px] text-fail">
            {runError}
          </pre>
        )}
        {ranLabel && (result || runError) && <p className="mb-2 text-[13.5px] text-muted">Ran {ranLabel}</p>}
        {result ? (
          <ResultView result={result} name={name || "query"} spec={chart} onSpecChange={setChart} />
        ) : (
          !runError && <p className="text-muted">Run the query to see results. Charts you set up here are saved with the query and shown on the dashboard.</p>
        )}
      </section>

      {id && (
        <div className="mt-12 border-t border-line pt-5">
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[14.5px]">Delete this saved query?</span>
              <form action={deleteQuery.bind(null, id, projectId)}>
                <button type="submit" className="btn !bg-fail">
                  Delete
                </button>
              </form>
              <button type="button" className="btn btn-quiet" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="text-[14px] text-muted underline hover:text-fail" onClick={() => setConfirmDelete(true)}>
              Delete query
            </button>
          )}
        </div>
      )}
    </div>
  );
}
