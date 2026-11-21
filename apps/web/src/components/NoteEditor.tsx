"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";
import { deleteNote, saveNote } from "@/app/lab/workspace-actions";
import { ago } from "@/lib/format";
import type { Note } from "@/lib/types";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "error"; message: string }
  | { kind: "conflict"; message: string; currentVersion: number };

const AUTOSAVE_MS = 4000;

export function NoteEditor({ note }: { note: Note }) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [version, setVersion] = useState(note.version);
  const [meta, setMeta] = useState({ updated_at: note.updated_at, by: note.last_edited_by });
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [view, setView] = useState<"write" | "preview" | "split">("split");
  const [autosave, setAutosave] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saved, setSaved] = useState({ title: note.title, body: note.body });
  const inFlight = useRef(false);

  const dirty = title !== saved.title || body !== saved.body;

  const save = useCallback(
    async (baseVersion = version) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setStatus({ kind: "saving" });
      const sent = { title, body };
      const res = await saveNote(note.id, baseVersion, sent.title, sent.body);
      inFlight.current = false;
      if (res.ok) {
        setSaved(sent);
        setVersion(res.version);
        setMeta({ updated_at: res.updated_at, by: res.last_edited_by });
        setStatus({ kind: "idle" });
      } else if (res.conflict) {
        setStatus({ kind: "conflict", message: res.error, currentVersion: res.conflict.current_version });
      } else {
        setStatus({ kind: "error", message: res.error });
      }
    },
    [note.id, title, body, version],
  );

  // Mark dirty / autosave after a pause in typing (never while a conflict is unresolved).
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    if (!dirty || !autosave) return;
    const t = setTimeout(() => {
      const k = statusRef.current.kind;
      if (k === "idle" || k === "error") void save();
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [title, body, dirty, autosave, save]);

  // Cmd/Ctrl+S saves; warn before leaving with unsaved changes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty) void save();
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
  }, [dirty, save]);

  const statusText =
    status.kind === "saving"
      ? "Saving…"
      : dirty
        ? autosave && status.kind === "idle"
          ? "Unsaved changes · autosaves when you pause"
          : "Unsaved changes"
        : `Saved · v${version} · ${ago(meta.updated_at)} by ${meta.by || "you"}`;

  return (
    <div>
      <input
        aria-label="Note title"
        className="w-full bg-transparent text-[26px] font-bold leading-tight tracking-tight outline-none focus-visible:outline-2"
        value={title}
        maxLength={200}
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="sticky top-14 z-10 -mx-1 mt-3 flex flex-wrap items-center justify-between gap-3 bg-bg/95 px-1 py-2 backdrop-blur lg:top-0">
        <div role="tablist" aria-label="Editor view" className="flex rounded-lg border border-line p-0.5">
          {(["write", "split", "preview"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              type="button"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`min-h-9 rounded-md px-3 text-[14px] capitalize ${v === "split" ? "hidden lg:block" : ""} ${view === v ? "bg-sunken font-semibold" : "text-muted"}`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13.5px] text-muted" role="status" aria-live="polite">
            {statusText}
          </span>
          <label className="flex items-center gap-2 text-[13.5px] text-muted">
            <input type="checkbox" className="h-4 w-4 accent-(--accent)" checked={autosave} onChange={(e) => setAutosave(e.target.checked)} />
            Autosave
          </label>
          <button type="button" className="btn !min-h-10" disabled={!dirty || status.kind === "saving"} onClick={() => void save()}>
            Save
          </button>
        </div>
      </div>

      {status.kind === "conflict" && (
        <div role="alert" className="mt-3 rounded-lg border border-run/50 bg-run/10 p-3 text-[14.5px]">
          <p className="font-semibold text-run">Someone else saved this note (now v{status.currentVersion}) while you were editing.</p>
          <p className="mt-1">Your text is still here. Choose what to keep:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn !min-h-10" onClick={() => void save(status.currentVersion)}>
              Keep mine (overwrite theirs)
            </button>
            <a className="btn btn-quiet !min-h-10" href={`?latest=${status.currentVersion}`} target="_blank" rel="noopener">
              Open their version in a new tab
            </a>
          </div>
        </div>
      )}
      {status.kind === "error" && (
        <p role="alert" className="mt-3 rounded-lg border border-fail/40 bg-fail/8 px-3 py-2 text-[14.5px] text-fail">
          Not saved: {status.message}
        </p>
      )}

      <div className={`mt-3 grid gap-4 ${view === "split" ? "lg:grid-cols-2" : ""}`}>
        <div className={view === "preview" ? "hidden" : view === "split" ? "max-lg:block" : ""}>
          <textarea
            aria-label="Note body (Markdown)"
            className="field min-h-[65vh] resize-y font-mono !text-[14px] leading-relaxed"
            value={body}
            spellCheck
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write in Markdown. Tables: | a | b |"
          />
        </div>
        <div className={view === "write" ? "hidden" : view === "split" ? "hidden lg:block" : ""}>
          <div className="sheet min-h-[65vh] overflow-auto p-5">
            {body.trim() ? <Markdown text={body} /> : <p className="text-muted">Nothing to preview yet.</p>}
          </div>
        </div>
      </div>

      <div className="mt-10 border-t border-line pt-5">
        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[14.5px]">Delete this note permanently?</span>
            <form action={deleteNote.bind(null, note.id, note.project_id)}>
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
            Delete note
          </button>
        )}
      </div>
    </div>
  );
}
