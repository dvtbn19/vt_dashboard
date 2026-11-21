/**
 * Working notes are stored as Markdown (so agents and exports stay simple) but edited as a form:
 * every `## heading` is a section, and inside it free text and Markdown tables become fields.
 * parse → serialize keeps the content (whitespace is normalised); unknown Markdown stays as text.
 */

export type TextBlock = { kind: "text"; text: string };
export type TableBlock = { kind: "table"; columns: string[]; rows: string[][] };
export type Block = TextBlock | TableBlock;
export type Section = { title: string; blocks: Block[] };
export type NoteDoc = { heading: string; intro: string; sections: Section[] };

const TABLE_SEP = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (s[i] === "|") {
      cells.push(cur);
      cur = "";
    } else cur += s[i];
  }
  cells.push(cur);
  return cells.map((c) => c.trim().replace(/<br\s*\/?>/gi, "\n"));
}

function cell(v: string): string {
  return v.trim().replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function trimLines(lines: string[]): string {
  return lines.join("\n").replace(/^\s*\n/, "").trimEnd();
}

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let text: string[] = [];
  const flush = () => {
    const t = trimLines(text);
    if (t.trim()) blocks.push({ kind: "text", text: t });
    text = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1].trim())) {
      flush();
      const columns = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const r = splitRow(lines[i]);
        rows.push(columns.map((_, ci) => r[ci] ?? ""));
        i++;
      }
      i--;
      blocks.push({ kind: "table", columns, rows });
    } else {
      text.push(line);
    }
  }
  flush();
  return blocks;
}

export function parseNote(md: string): NoteDoc {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let heading = "";
  let start = 0;
  // Skip blank lines, then take a leading "# Title" as the document heading.
  while (start < lines.length && !lines[start].trim()) start++;
  if (start < lines.length && /^#\s+/.test(lines[start])) {
    heading = lines[start].replace(/^#\s+/, "").trim();
    start++;
  }
  const intro: string[] = [];
  const sections: { title: string; lines: string[] }[] = [];
  let inFence = false;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) inFence = !inFence;
    const m = !inFence && /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) sections.push({ title: m[1], lines: [] });
    else if (sections.length) sections[sections.length - 1].lines.push(line);
    else intro.push(line);
  }
  return {
    heading,
    intro: trimLines(intro),
    sections: sections.map((s) => ({ title: s.title, blocks: parseBlocks(s.lines) })),
  };
}

export function serializeNote(doc: NoteDoc): string {
  const out: string[] = [];
  if (doc.heading.trim()) out.push(`# ${doc.heading.trim()}`, "");
  if (doc.intro.trim()) out.push(doc.intro.trimEnd(), "");
  for (const s of doc.sections) {
    out.push(`## ${s.title.trim() || "Untitled section"}`, "");
    for (const b of s.blocks) {
      if (b.kind === "text") {
        if (b.text.trim()) out.push(b.text.trimEnd(), "");
      } else {
        const numbered = isNumberColumn(b.columns[0]);
        out.push(`| ${b.columns.map(cell).join(" | ")} |`);
        out.push(`|${b.columns.map(() => "---").join("|")}|`);
        const rows = b.rows.length ? b.rows : [b.columns.map(() => "")];
        rows.forEach((r, ri) => {
          const vals = b.columns.map((_, ci) => (numbered && ci === 0 ? String(ri + 1) : cell(r[ci] ?? "")));
          out.push(`| ${vals.join(" | ")} |`);
        });
        out.push("");
      }
    }
  }
  return out.join("\n").trimEnd() + "\n";
}

export function isNumberColumn(name: string | undefined): boolean {
  return !!name && /^(#|no\.?|stt)$/i.test(name.trim());
}

/** Rows that contain something besides the auto number. */
export function filledRows(t: TableBlock): string[][] {
  const numbered = isNumberColumn(t.columns[0]);
  return t.rows.filter((r) => r.some((v, i) => !(numbered && i === 0) && v.trim() && !/^_?\(.*\)_?$/.test(v.trim())));
}

// ------------------------------------------------------------------ sections by role

export type SectionRole = "request" | "questions" | "checks" | "decisions" | "hypotheses" | "findings" | "recommendations" | "qa";

const ROLE_BY_NUMBER: Record<string, SectionRole> = {
  "1": "request",
  "2": "questions",
  "3": "checks",
  "4": "decisions",
  "5": "hypotheses",
  "6": "findings",
  "7": "recommendations",
  "8": "qa",
};

const ROLE_WORDS: [SectionRole, RegExp][] = [
  ["findings", /finding|phát hiện|insight|kết quả/i],
  ["recommendations", /recommend|đề xuất|khuyến nghị|next step/i],
  ["request", /request|yêu cầu|question we|bối cảnh|context/i],
  ["checks", /data check|kiểm tra dữ liệu/i],
  ["decisions", /decision|assumption|giả định|quyết định/i],
  ["hypotheses", /hypothes|giả thuyết/i],
  ["qa", /presentation|thuyết trình|q&a/i],
  ["questions", /question|câu hỏi/i],
];

/** Which part of the working-notes template a section is: by its number ("6. …"), else by words. */
export function sectionRole(title: string): SectionRole | null {
  const n = /^\s*(\d+)[.)]/.exec(title)?.[1];
  if (n && ROLE_BY_NUMBER[n]) return ROLE_BY_NUMBER[n];
  return ROLE_WORDS.find(([, re]) => re.test(title))?.[0] ?? null;
}

export function findSection(doc: NoteDoc, role: SectionRole): Section | undefined {
  return doc.sections.find((s) => sectionRole(s.title) === role);
}

export function sectionText(s: Section | undefined): string {
  return (s?.blocks ?? [])
    .filter((b): b is TextBlock => b.kind === "text")
    .map((b) => b.text)
    .join("\n\n")
    .trim();
}

export function sectionTable(s: Section | undefined): TableBlock | undefined {
  return s?.blocks.find((b): b is TableBlock => b.kind === "table");
}
