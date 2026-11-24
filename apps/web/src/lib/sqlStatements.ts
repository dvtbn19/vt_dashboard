/**
 * Split an SQL editor's text into statements at top-level semicolons, ignoring semicolons inside
 * 'strings', "identifiers", $tag$ dollar quotes $tag$, -- line comments and /* block comments *\/.
 * Mirrors services/api/app/analytics.py::split_statements (the server runs a saved query's first statement).
 */

export type Statement = {
  /** Offset of the first character (just after the previous `;`). */
  start: number;
  /** Offset of the terminating `;`, or the text length for the last statement. */
  end: number;
  text: string;
  /** Only whitespace and comments. */
  empty: boolean;
};

export function splitStatements(sql: string): Statement[] {
  const out: Statement[] = [];
  let start = 0;
  let hasCode = false;
  let i = 0;
  const n = sql.length;
  const push = (end: number) => {
    out.push({ start, end, text: sql.slice(start, end), empty: !hasCode });
    start = end + 1;
    hasCode = false;
  };
  while (i < n) {
    const c = sql[i];
    const next = sql[i + 1];
    if (c === "-" && next === "-") {
      const nl = sql.indexOf("\n", i);
      i = nl === -1 ? n : nl + 1;
    } else if (c === "/" && next === "*") {
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (sql[i] === "/" && sql[i + 1] === "*") {
          depth++;
          i += 2;
        } else if (sql[i] === "*" && sql[i + 1] === "/") {
          depth--;
          i += 2;
        } else i++;
      }
    } else if (c === "'" || c === '"') {
      hasCode = true;
      i++;
      while (i < n) {
        if (sql[i] === c) {
          if (sql[i + 1] === c) i += 2; // '' or "" escape
          else break;
        } else i++;
      }
      i++;
    } else if (c === "$") {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      hasCode = true;
      if (m) {
        const close = sql.indexOf(m[0], i + m[0].length);
        i = close === -1 ? n : close + m[0].length;
      } else i++;
    } else if (c === ";") {
      push(i);
      i++;
    } else {
      if (!/\s/.test(c)) hasCode = true;
      i++;
    }
  }
  if (start <= n) push(n);
  return out;
}

export type Picked = {
  sql: string;
  /** What ran, for the status line; null when the whole editor (a single statement) ran. */
  label: string | null;
  /** Editor range of what ran, to re-select it. */
  range: [number, number] | null;
};

function lineOf(sql: string, offset: number) {
  let line = 1;
  for (let i = 0; i < offset && i < sql.length; i++) if (sql[i] === "\n") line++;
  return line;
}

/** Trim a statement's range to its first and last non-whitespace characters. */
function trimmed(sql: string, s: Statement): [number, number] {
  let a = s.start;
  let b = s.end;
  while (a < b && /\s/.test(sql[a])) a++;
  while (b > a && /\s/.test(sql[b - 1])) b--;
  return [a, b];
}

/**
 * What Run should execute: the selection if there is one, otherwise the statement under the cursor
 * (or the nearest one before it), otherwise the whole text.
 */
export function pickStatement(sql: string, selStart: number, selEnd: number): Picked {
  if (selEnd > selStart && sql.slice(selStart, selEnd).trim()) {
    const a = lineOf(sql, selStart);
    const b = lineOf(sql, selEnd);
    return { sql: sql.slice(selStart, selEnd), label: a === b ? `selection (line ${a})` : `selection (lines ${a}–${b})`, range: null };
  }
  const all = splitStatements(sql);
  const real = all.filter((s) => !s.empty);
  if (real.length <= 1) return { sql, label: null, range: null };
  // The cursor belongs to the statement it is in, or right after its `;`.
  let idx = all.findIndex((s) => selStart >= s.start && selStart <= s.end);
  if (idx === -1) idx = all.length - 1;
  // Right after `select 1;` on the same line means that statement, not the next one.
  if (idx > 0 && /^[ \t]*$/.test(sql.slice(all[idx].start, selStart))) idx--;
  let chosen = all[idx];
  if (chosen.empty) {
    // In blank space between statements: take the one above, or else the next one below.
    const above = all.slice(0, idx).reverse().find((s) => !s.empty);
    chosen = above ?? all.slice(idx).find((s) => !s.empty) ?? real[0];
  }
  const range = trimmed(sql, chosen);
  const number = real.indexOf(chosen) + 1;
  const a = lineOf(sql, range[0]);
  const b = lineOf(sql, range[1]);
  return {
    sql: chosen.text,
    label: `statement ${number} of ${real.length} (${a === b ? `line ${a}` : `lines ${a}–${b}`})`,
    range,
  };
}

export function countStatements(sql: string): number {
  return splitStatements(sql).filter((s) => !s.empty).length;
}
