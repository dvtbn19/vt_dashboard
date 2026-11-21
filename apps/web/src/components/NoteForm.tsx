"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AutoTextarea } from "./AutoTextarea";
import { deleteNote, saveNote } from "@/app/lab/workspace-actions";
import { ago } from "@/lib/format";
import {
  isNumberColumn,
  parseNote,
  sectionRole,
  serializeNote,
  type Block,
  type NoteDoc,
  type Section,
  type TableBlock,
} from "@/lib/noteDoc";
import { SECTION_HINTS } from "@/lib/templates";
import type { Note, NoteLink, SavedQueryListItem } from "@/lib/types";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "error"; message: string }
  | { kind: "conflict"; message: string; currentVersion: number };

const AUTOSAVE_MS = 3000;

/** Every section gets at least one text field to type into. */
function editable(doc: NoteDoc): NoteDoc {
  return {
    ...doc,
    sections: doc.sections.map((s) => (s.blocks.length ? s : { ...s, blocks: [{ kind: "text", text: "" }] })),
  };
}

type Props = {
  note: Note;
  queries: Pick<SavedQueryListItem, "id" | "name">[];
  /** The query open next to the note (workspace), offered as a one-click link. */
  currentQuery?: { id: string; name: string } | null;
  onOpenQuery?: (id: string) => void;
  onLinksChange?: (links: NoteLink[]) => void;
  compact?: boolean;
};

export function NoteForm({ note, queries, currentQuery, onOpenQuery, onLinksChange, compact }: Props) {
  const initial = useMemo(() => editable(parseNote(note.body)), [note.body]);
  const [title, setTitle] = useState(note.title);
  const [doc, setDoc] = useState<NoteDoc>(initial);
  const [raw, setRaw] = useState<string | null>(null); // non-null while editing Markdown directly
  const [links, setLinks] = useState<NoteLink[]>(note.links ?? []);
  const [version, setVersion] = useState(note.version);
  const [meta, setMeta] = useState({ updated_at: note.updated_at, by: note.last_edited_by });
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [autosave, setAutosave] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saved, setSaved] = useState(() => ({
    title: note.title,
    body: serializeNote(initial),
    links: JSON.stringify(note.links ?? []),
  }));
  const inFlight = useRef(false);

  const body = raw ?? serializeNote(doc);
  const linksJson = JSON.stringify(links);
  const dirty = title !== saved.title || body !== saved.body || linksJson !== saved.links;

  useEffect(() => {
    onLinksChange?.(links);
  }, [links, onLinksChange]);

  const save = useCallback(
    async (baseVersion = version) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setStatus({ kind: "saving" });
      const sent = { title, body, links };
      const res = await saveNote(note.id, baseVersion, sent.title, sent.body, sent.links);
      inFlight.current = false;
      if (res.ok) {
        setSaved({ title: sent.title, body: sent.body, links: JSON.stringify(sent.links) });
        setVersion(res.version);
        setMeta({ updated_at: res.updated_at, by: res.last_edited_by });
        setStatus({ kind: "idle" });
      } else if (res.conflict) {
        setStatus({ kind: "conflict", message: res.error, currentVersion: res.conflict.current_version });
      } else {
        setStatus({ kind: "error", message: res.error });
      }
    },
    [note.id, title, body, links, version],
  );

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
  }, [title, body, linksJson, dirty, autosave, save]);

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

  // ---------------------------------------------------------------- edits
  const setSection = (i: number, s: Section) =>
    setDoc((d) => ({ ...d, sections: d.sections.map((x, j) => (j === i ? s : x)) }));
  const renameSection = (i: number, next: string) => {
    const prev = doc.sections[i].title;
    setSection(i, { ...doc.sections[i], title: next });
    setLinks((ls) => ls.map((l) => (l.section === prev ? { ...l, section: next } : l)));
  };
  const removeSection = (i: number) => {
    const t = doc.sections[i].title;
    setDoc((d) => ({ ...d, sections: d.sections.filter((_, j) => j !== i) }));
    setLinks((ls) => ls.filter((l) => l.section !== t));
  };
  const addSection = () =>
    setDoc((d) => ({
      ...d,
      sections: [...d.sections, { title: `${d.sections.length + 1}. New section`, blocks: [{ kind: "text", text: "" }] }],
    }));
  const link = (section: string, queryId: string) =>
    setLinks((ls) => (ls.some((l) => l.section === section && l.query_id === queryId) ? ls : [...ls, { query_id: queryId, section }]));
  const unlink = (section: string, queryId: string) =>
    setLinks((ls) => ls.filter((l) => !(l.section === section && l.query_id === queryId)));

  const toMarkdown = () => setRaw(serializeNote(doc));
  const toForm = () => {
    if (raw !== null) setDoc(editable(parseNote(raw)));
    setRaw(null);
  };

  const hrefFor = (queryId: string) => `/lab/projects/${note.project_id}/workspace?note=${note.id}&query=${queryId}`;
  const names = useMemo(() => new Map(queries.map((q) => [q.id, q.name])), [queries]);
  const known = links.filter((l) => names.has(l.query_id));
  const sectionTitles = new Set(doc.sections.map((s) => s.title));
  const loose = known.filter((l) => !sectionTitles.has(l.section));

  const statusText =
    status.kind === "saving"
      ? "Saving…"
      : dirty
        ? autosave && status.kind === "idle"
          ? "Editing · autosaves"
          : "Unsaved changes"
        : `Saved · v${version} · ${ago(meta.updated_at)}${meta.by ? ` by ${meta.by}` : ""}`;

  return (
    <div className="@container">
      <div className={`z-10 border-b border-line bg-bg/95 pb-2 backdrop-blur ${compact ? "sticky top-[100px] pt-1 lg:top-0" : "sticky top-14 pt-2 lg:top-0"}`}>
        <input
          aria-label="Note title"
          className="w-full bg-transparent text-[22px] font-bold leading-tight tracking-tight outline-none focus-visible:outline-2"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className={`text-[13px] ${dirty ? "text-run" : "text-muted"}`} role="status" aria-live="polite">
            {statusText}
          </span>
          <div className="flex items-center gap-2">
            <div role="tablist" aria-label="Editor mode" className="flex rounded-lg border border-line p-0.5">
              <button
                role="tab"
                type="button"
                aria-selected={raw === null}
                onClick={toForm}
                className={`min-h-8 rounded-md px-2.5 text-[13px] ${raw === null ? "bg-sunken font-semibold" : "text-muted"}`}
              >
                Form
              </button>
              <button
                role="tab"
                type="button"
                aria-selected={raw !== null}
                onClick={toMarkdown}
                className={`min-h-8 rounded-md px-2.5 text-[13px] ${raw !== null ? "bg-sunken font-semibold" : "text-muted"}`}
              >
                Markdown
              </button>
            </div>
            <label className="flex items-center gap-1.5 text-[13px] text-muted">
              <input type="checkbox" className="h-4 w-4 accent-(--accent)" checked={autosave} onChange={(e) => setAutosave(e.target.checked)} />
              Auto
            </label>
            <button type="button" className="btn !min-h-9 !px-3 text-[14px]" disabled={!dirty || status.kind === "saving"} onClick={() => void save()}>
              Save
            </button>
          </div>
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
            <a className="btn btn-quiet !min-h-10" href={`/lab/projects/${note.project_id}/notes/${note.id}`} target="_blank" rel="noopener">
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

      {raw !== null ? (
        <div className="mt-4">
          <p className="hint mb-2">
            Raw Markdown. Each <code className="font-mono">## heading</code> becomes a section and each table becomes rows when you switch back to Form.
          </p>
          <AutoTextarea aria-label="Note (Markdown)" className="min-h-[60vh] font-mono !text-[14px]" value={raw} onChange={setRaw} minRows={20} />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {(doc.intro || doc.sections.length === 0) && (
            <AutoTextarea
              aria-label="Introduction"
              className="text-[15px]"
              placeholder="Context, sources, caveats…"
              value={doc.intro}
              onChange={(v) => setDoc((d) => ({ ...d, intro: v }))}
            />
          )}
          {doc.sections.map((s, i) => (
            <SectionCard
              key={i}
              section={s}
              onChange={(next) => setSection(i, next)}
              onRename={(t) => renameSection(i, t)}
              onRemove={() => removeSection(i)}
              links={known.filter((l) => l.section === s.title)}
              names={names}
              queries={queries}
              currentQuery={currentQuery ?? null}
              onLink={(qid) => link(s.title, qid)}
              onUnlink={(qid) => unlink(s.title, qid)}
              onOpenQuery={onOpenQuery}
              hrefFor={hrefFor}
            />
          ))}
          {loose.length > 0 && (
            <div className="sheet p-4">
              <p className="text-[14px] font-semibold">Linked to the whole note</p>
              <LinkChips links={loose} names={names} onOpen={onOpenQuery} hrefFor={hrefFor} onRemove={(l) => unlink(l.section, l.query_id)} />
            </div>
          )}
          <button type="button" className="btn btn-quiet w-full border-dashed" onClick={addSection}>
            + Add section
          </button>
        </div>
      )}

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

// ------------------------------------------------------------------ pieces

function LinkChips({
  links,
  names,
  onOpen,
  onRemove,
  hrefFor,
}: {
  links: NoteLink[];
  names: Map<string, string>;
  onOpen?: (id: string) => void;
  onRemove: (l: NoteLink) => void;
  hrefFor: (queryId: string) => string;
}) {
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {links.map((l) => (
        <li key={l.query_id} className="flex items-center rounded-full border border-accent/40 bg-accent/8 text-[13px]">
          {onOpen ? (
            <button type="button" className="min-h-8 rounded-l-full py-1 pl-3 pr-1.5 font-mono text-accent hover:underline" onClick={() => onOpen(l.query_id)} title="Open this SQL">
              {names.get(l.query_id)}
            </button>
          ) : (
            <a className="min-h-8 rounded-l-full py-1.5 pl-3 pr-1.5 font-mono text-accent hover:underline" href={hrefFor(l.query_id)}>
              {names.get(l.query_id)}
            </a>
          )}
          <button
            type="button"
            className="min-h-8 rounded-r-full px-2 text-muted hover:text-fail"
            aria-label={`Unlink ${names.get(l.query_id)}`}
            onClick={() => onRemove(l)}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

function SectionCard({
  section,
  onChange,
  onRename,
  onRemove,
  links,
  names,
  queries,
  currentQuery,
  onLink,
  onUnlink,
  onOpenQuery,
  hrefFor,
}: {
  section: Section;
  onChange: (s: Section) => void;
  onRename: (title: string) => void;
  onRemove: () => void;
  links: NoteLink[];
  names: Map<string, string>;
  queries: Pick<SavedQueryListItem, "id" | "name">[];
  currentQuery: { id: string; name: string } | null;
  onLink: (queryId: string) => void;
  onUnlink: (queryId: string) => void;
  onOpenQuery?: (id: string) => void;
  hrefFor: (queryId: string) => string;
}) {
  const [confirm, setConfirm] = useState(false);
  const role = sectionRole(section.title);
  const hint = role ? SECTION_HINTS[role] : null;
  const setBlock = (i: number, b: Block) => onChange({ ...section, blocks: section.blocks.map((x, j) => (j === i ? b : x)) });
  const linkedIds = new Set(links.map((l) => l.query_id));
  const offerCurrent = currentQuery && !linkedIds.has(currentQuery.id);
  const others = queries.filter((q) => !linkedIds.has(q.id));

  return (
    <section className="sheet p-4" aria-label={section.title}>
      <div className="flex items-start gap-2">
        <input
          aria-label="Section title"
          className="min-w-0 flex-1 bg-transparent text-[16.5px] font-bold outline-none focus-visible:outline-2"
          value={section.title}
          maxLength={200}
          onChange={(e) => onRename(e.target.value)}
        />
        {confirm ? (
          <span className="flex shrink-0 items-center gap-1 text-[13px]">
            <button type="button" className="rounded-md px-2 py-1 font-semibold text-fail hover:bg-fail/10" onClick={onRemove}>
              Remove
            </button>
            <button type="button" className="rounded-md px-2 py-1 text-muted hover:bg-sunken" onClick={() => setConfirm(false)}>
              Keep
            </button>
          </span>
        ) : (
          <button type="button" className="shrink-0 rounded-md px-2 py-1 text-[13px] text-muted hover:bg-sunken hover:text-fail" onClick={() => setConfirm(true)} aria-label={`Remove section ${section.title}`}>
            Remove
          </button>
        )}
      </div>
      {hint && <p className="hint mt-0.5">{hint}</p>}

      <div className="mt-3 space-y-3">
        {section.blocks.map((b, i) =>
          b.kind === "text" ? (
            <AutoTextarea
              key={i}
              aria-label={`${section.title}: text`}
              className="text-[15px]"
              placeholder={role === "recommendations" ? "1. …\n2. …" : "Write here…"}
              minRows={role === "request" || role === "recommendations" ? 3 : 2}
              value={b.text}
              onChange={(text) => setBlock(i, { kind: "text", text })}
            />
          ) : (
            <TableRows key={i} table={b} label={section.title} onChange={(t) => setBlock(i, t)} />
          ),
        )}
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="font-semibold text-muted">SQL</span>
          {offerCurrent && (
            <button type="button" className="min-h-8 rounded-full border border-dashed border-accent/60 px-3 text-accent hover:bg-accent/8" onClick={() => onLink(currentQuery.id)}>
              + Link “{currentQuery.name}”
            </button>
          )}
          {others.length > 0 && (
            <select
              aria-label={`Link a saved query to ${section.title}`}
              className="min-h-8 max-w-[14rem] rounded-full border border-line bg-surface px-2 text-[13px] text-muted"
              value=""
              onChange={(e) => e.target.value && onLink(e.target.value)}
            >
              <option value="">Link saved query…</option>
              {others.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          )}
          {!offerCurrent && others.length === 0 && links.length === 0 && <span className="text-muted">No saved queries yet.</span>}
        </div>
        {links.length > 0 && <LinkChips links={links} names={names} onOpen={onOpenQuery} hrefFor={hrefFor} onRemove={(l) => onUnlink(l.query_id)} />}
      </div>
    </section>
  );
}

function TableRows({ table, label, onChange }: { table: TableBlock; label: string; onChange: (t: TableBlock) => void }) {
  const numbered = isNumberColumn(table.columns[0]);
  const fields = table.columns.map((c, i) => ({ c, i })).filter(({ i }) => !(numbered && i === 0));
  const rows = table.rows.length ? table.rows : [table.columns.map(() => "")];
  const setCell = (ri: number, ci: number, v: string) =>
    onChange({ ...table, rows: rows.map((r, j) => (j === ri ? r.map((x, k) => (k === ci ? v : x)) : r)) });
  const addRow = () => onChange({ ...table, rows: [...rows, table.columns.map(() => "")] });
  const removeRow = (ri: number) => onChange({ ...table, rows: rows.filter((_, j) => j !== ri) });

  return (
    <div className="space-y-2">
      {rows.map((r, ri) => (
        <div key={ri} className="rounded-xl border border-line bg-bg/60 p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="tnum text-[12.5px] font-semibold text-muted">{numbered ? `#${ri + 1}` : `Row ${ri + 1}`}</span>
            {rows.length > 1 && (
              <button type="button" className="rounded-md px-2 py-0.5 text-[12.5px] text-muted hover:bg-sunken hover:text-fail" onClick={() => removeRow(ri)} aria-label={`Remove row ${ri + 1} of ${label}`}>
                Remove
              </button>
            )}
          </div>
          <div className={`grid gap-2 ${fields.length > 2 ? "@xl:grid-cols-2" : ""}`}>
            {fields.map(({ c, i }, fi) => (
              <label key={i} className={`block min-w-0 ${fields.length > 2 && fi === 0 ? "@xl:col-span-2" : ""}`}>
                <span className="mb-1 block text-[12.5px] font-semibold text-muted">{c}</span>
                <AutoTextarea minRows={1} className="!min-h-10 !py-2 text-[15px]" value={r[i] ?? ""} onChange={(v) => setCell(ri, i, v)} />
              </label>
            ))}
          </div>
        </div>
      ))}
      <button type="button" className="min-h-9 rounded-lg px-3 text-[13.5px] font-semibold text-accent hover:bg-accent/8" onClick={addRow}>
        + Add row
      </button>
    </div>
  );
}
