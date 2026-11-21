"use client";

export function PrintButton() {
  return (
    <button type="button" className="min-h-10 rounded-lg px-3 text-[14px] text-muted hover:bg-sunken hover:text-ink" onClick={() => window.print()}>
      Print / PDF
    </button>
  );
}
