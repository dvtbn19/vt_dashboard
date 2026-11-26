"use client";

import { useSyncExternalStore } from "react";

/**
 * The open notebook's table of contents (`#` headings of its Markdown cells), shared between the
 * notebook (which publishes it) and the lab sidebar (which shows it). One notebook is open at a time.
 */
export type TocItem = { level: number; text: string; cellKey: string; nth: number };

const EMPTY: TocItem[] = [];
let current: TocItem[] = EMPTY;
const listeners = new Set<() => void>();

export function publishToc(items: TocItem[]) {
  current = items.length ? items : EMPTY;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useNotebookToc(): TocItem[] {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => EMPTY,
  );
}

/** `#`…`######` headings of Markdown text, skipping fenced code blocks. */
export function headingsOf(text: string): { level: number; text: string }[] {
  const out: { level: number; text: string }[] = [];
  let fence = false;
  for (const line of text.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (fence) continue;
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) out.push({ level: m[1].length, text: m[2].replace(/[*_`]/g, "") });
  }
  return out;
}

const HEADINGS = ".prose-lab h1, .prose-lab h2, .prose-lab h3, .prose-lab h4, .prose-lab h5, .prose-lab h6";

/** The rendered heading of a Markdown cell (falls back to the cell itself while it is being edited). */
export function headingElement(cellKey: string, nth?: number): HTMLElement | null {
  const cell = document.getElementById(`cell-${cellKey}`);
  if (!cell || nth === undefined) return cell;
  return (cell.querySelectorAll<HTMLElement>(HEADINGS)[nth] ?? cell) as HTMLElement;
}

export function scrollToHeading(cellKey: string, nth?: number) {
  headingElement(cellKey, nth)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
