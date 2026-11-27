import type { Artifact, Metric } from "./types";

/**
 * Turns a run's files into a dashboard: the run's story (a Markdown report whose `##` sections say
 * which charts they discuss, e.g. "## 1. Did it work? (chart 0, 1)") with those charts under each
 * section. Charts are numbered by their description ("3 · Title") or file name ("story_3_x.json").
 */

export type StorySection = { heading: string; body: string; charts: number[] };
export type Story = { title: string; intro: string; sections: StorySection[] };

const REF_WORDS = "biểu đồ|bieu do|charts?|figures?|figs?\\.?|exhibits?|hình";
const REF_RE = new RegExp(`\\(\\s*(?:${REF_WORDS})\\s*([0-9][0-9\\s,;&–—-]*(?:(?:và|and)\\s*[0-9]+)?)\\s*\\)`, "i");
const ANY_REF_RE = new RegExp(`(?:${REF_WORDS})\\s*[0-9]`, "gi");

/** "0, 1" / "2–4" / "5 và 6" → [0, 1] / [2, 3, 4] / [5, 6]. */
function numbersOf(list: string): number[] {
  const out: number[] = [];
  for (const part of list.split(/,|;|&|\bvà\b|\band\b/i)) {
    const range = /^\s*(\d+)\s*[–—-]\s*(\d+)\s*$/.exec(part);
    if (range) {
      const [a, b] = [Number(range[1]), Number(range[2])];
      for (let i = Math.min(a, b); i <= Math.max(a, b) && i - a < 50; i++) out.push(i);
    } else {
      const n = /(\d+)/.exec(part);
      if (n) out.push(Number(n[1]));
    }
  }
  return [...new Set(out)];
}

export function chartNumber(a: Artifact): number | null {
  const d = a.description ? /^\s*(\d{1,3})[a-z]?\s*[·.:)–—-]/i.exec(a.description) : null;
  if (d) return Number(d[1]);
  // "story_3_x.json", and "store_3a_x.json" / "store_3b_x.json" both count as chart 3.
  const n = /(?:^|[_\-\s])(\d{1,3})[a-z]?(?=[_\-\s.])/i.exec(a.name);
  return n ? Number(n[1]) : null;
}

/** The chart's number as written ("3", or "3a" for a file named store_3a_x.json). */
export function chartLabel(a: Artifact): string | null {
  const d = a.description ? /^\s*(\d{1,3}[a-z]?)\s*[·.:)–—-]/i.exec(a.description) : null;
  if (d) return d[1];
  const n = /(?:^|[_\-\s])(\d{1,3}[a-z]?)(?=[_\-\s.])/i.exec(a.name);
  return n ? n[1] : null;
}

/** The chart's caption without its leading number. */
export function chartCaption(a: Artifact): string {
  return (a.description || a.name).replace(/^\s*\d{1,3}[a-z]?\s*[·.:)–—-]\s*/i, "");
}

/**
 * Where a long section's charts go: after its opening text, before the first table or `###`
 * sub-heading, so the charts are seen next to the summary rather than after pages of detail.
 */
export function splitLead(body: string): { lead: string; tail: string } {
  const lines = body.split("\n");
  let fence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) fence = !fence;
    if (!fence && i > 0 && (/^\s*\|/.test(lines[i]) || /^###\s/.test(lines[i]))) {
      // Keep a heading/label line that introduces the table with the table.
      let at = i;
      while (at > 0 && lines[at - 1].trim() === "") at--;
      if (at > 0 && /^\s*(\*\*[^*]+\*\*:?|#{3,6}\s.*)\s*$/.test(lines[at - 1])) at--;
      return { lead: lines.slice(0, at).join("\n").trim(), tail: lines.slice(at).join("\n").trim() };
    }
  }
  return { lead: body.trim(), tail: "" };
}

/** Short text without tables sits beside its charts; anything longer gets the full width. */
export function isCompact(body: string): boolean {
  return body.length < 1400 && !/^\s*\|/m.test(body) && !/^###\s/m.test(body);
}

export function parseStory(text: string): Story {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let title = "";
  const intro: string[] = [];
  const sections: StorySection[] = [];
  let fence = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const h2 = !fence ? /^##\s+(.+?)\s*#*\s*$/.exec(line) : null;
    const h1 = !fence && !title && !sections.length ? /^#\s+(.+?)\s*#*\s*$/.exec(line) : null;
    if (h1) {
      title = h1[1];
    } else if (h2) {
      const ref = REF_RE.exec(h2[1]);
      sections.push({
        heading: (ref ? h2[1].replace(ref[0], "") : h2[1]).replace(/\s+$/, ""),
        body: "",
        charts: ref ? numbersOf(ref[1]) : [],
      });
    } else if (sections.length) {
      sections[sections.length - 1].body += line + "\n";
    } else {
      intro.push(line);
    }
  }
  return { title, intro: intro.join("\n").trim(), sections: sections.map((s) => ({ ...s, body: s.body.trim() })) };
}

/** The report that tells the run's story: the Markdown file that refers to charts the most. */
export function pickStory<T extends { artifact: Artifact; text: string }>(docs: T[]): T | null {
  if (!docs.length) return null;
  const score = (d: T) => (d.text.match(ANY_REF_RE) ?? []).length * 10 + (/story|report|summary|readme/i.test(d.artifact.name) ? 1 : 0);
  return [...docs].sort((a, b) => score(b) - score(a))[0];
}

// ------------------------------------------------------------------ metrics

export type MetricGrid = { rows: string[]; columns: string[]; value: (row: string, col: string) => Metric | undefined };

function split(key: string, at: number): [string, string] {
  const parts = key.split("_");
  return [parts.slice(0, at).join("_"), parts.slice(at).join("_")];
}

/**
 * Metrics named `<thing>_<measure>` for several things and the same measures (cat_food_real_growth_pct,
 * coffee_real_growth_pct, …) read better as a table: one row per thing, one column per measure.
 * Returns null when the keys do not form such a grid.
 */
export function metricGrid(metrics: Metric[]): MetricGrid | null {
  const latest = new Map<string, Metric>();
  for (const m of metrics) {
    const prev = latest.get(m.key);
    if (!prev || (m.step ?? 0) >= (prev.step ?? 0)) latest.set(m.key, m);
  }
  const keys = [...latest.keys()];
  if (keys.length < 4) return null;
  // Each key's row is its longest `_`-prefix shared with another key.
  const cell = new Map<string, [string, string]>();
  for (const k of keys) {
    const n = k.split("_").length;
    for (let at = n - 1; at >= 1; at--) {
      const [p] = split(k, at);
      if (keys.some((o) => o !== k && o.startsWith(p + "_"))) {
        cell.set(k, split(k, at));
        break;
      }
    }
    if (!cell.has(k)) return null;
  }
  const rows = [...new Set([...cell.values()].map(([r]) => r))];
  const columns = [...new Set([...cell.values()].map(([, c]) => c))];
  if (rows.length < 2 || columns.length < 2 || columns.length > 6 || rows.length * columns.length !== keys.length) return null;
  const byCell = new Map([...cell.entries()].map(([k, [r, c]]) => [`${r}\u0000${c}`, latest.get(k)!]));
  if (byCell.size !== keys.length) return null;
  return { rows, columns, value: (r, c) => byCell.get(`${r}\u0000${c}`) };
}

export function humanize(key: string): string {
  const pct = /(^|_)(pct|percent)$/i.test(key);
  const base = key.replace(/_?(pct|percent)$/i, "").replace(/_/g, " ").trim();
  return `${base.charAt(0).toUpperCase()}${base.slice(1)}${pct ? " (%)" : ""}`;
}
