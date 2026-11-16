"use client";

import { useState } from "react";
import { career, lanes, type CareerItem } from "@/lib/profile";

const START = 2019;
const NOW = 2026.9;
const END = 2027;
const years = Array.from({ length: END - START + 1 }, (_, i) => START + i);

const pct = (y: number) => ((y - START) / (END - START)) * 100;

function fmtRange(c: CareerItem, lang: "en" | "vi") {
  const f = (y: number) => {
    const yr = Math.floor(y);
    const m = Math.round((y - yr) * 12) + 1;
    return new Date(Date.UTC(yr, m - 1, 1)).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-AU", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };
  return `${f(c.start)} – ${c.end ? f(c.end) : lang === "vi" ? "nay" : "now"}`;
}

/**
 * William's career as a swimlane time-series. Bars are buttons; the selected one is
 * described underneath with a margin note. Bars grow in order on first paint.
 */
export function CareerChart({ lang }: { lang: "en" | "vi" }) {
  const [sel, setSel] = useState<string>("ct");
  const active = career.find((c) => c.id === sel) ?? career[career.length - 1];
  const order = [...career].sort((a, b) => a.start - b.start).map((c) => c.id);

  return (
    <figure className="graph-paper overflow-hidden rounded-[10px] border border-rule">
      <figcaption className="sr-only">
        {lang === "vi" ? "Biểu đồ sự nghiệp của William từ 2019 đến nay" : "William's career from 2019 to now"}
      </figcaption>

      <div className="px-4 pb-2 pt-5 sm:px-6">
        {lanes.map((lane, li) => (
          <div key={li} className="grid grid-cols-1 gap-1 py-2.5 md:grid-cols-[170px_1fr] md:items-center md:gap-4">
            <div className="text-[13px] font-medium text-pencil">{lane[lang]}</div>
            <div className="relative h-9">
              {/* year gridlines */}
              {years.map((y) => (
                <span key={y} aria-hidden className="absolute inset-y-0 w-px bg-rule" style={{ left: `${pct(y)}%` }} />
              ))}
              {career
                .filter((c) => c.lane === li)
                .map((c) => {
                  const left = pct(c.start);
                  const width = Math.max(pct(c.end ?? NOW) - left, 2.2);
                  const on = c.id === active.id;
                  const study = c.kind === "study";
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSel(c.id)}
                      aria-pressed={on}
                      aria-label={`${c.role[lang]}, ${c.org}, ${fmtRange(c, lang)}`}
                      className="group absolute top-1 h-7 cursor-pointer"
                      style={{ left: `${left}%`, width: `${width}%` }}
                    >
                      <span
                        className={`grow absolute inset-0 rounded-[3px] border transition-colors ${
                          on
                            ? "border-signal bg-signal"
                            : study
                              ? "border-ink/60 bg-[repeating-linear-gradient(135deg,transparent_0_4px,color-mix(in_srgb,var(--ink)_22%,transparent)_4px_5px)] group-hover:border-signal"
                              : "border-ink bg-ink group-hover:border-signal group-hover:bg-signal"
                        }`}
                        style={{ animationDelay: `${order.indexOf(c.id) * 110}ms` }}
                      />
                      {c.end === null ? (
                        <span
                          aria-hidden
                          className={`absolute -right-1.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-r-2 border-t-2 ${
                            on ? "border-signal" : "border-ink"
                          }`}
                        />
                      ) : null}
                      <span
                        className={`pointer-events-none absolute left-0 top-full mt-0.5 hidden whitespace-nowrap text-[12px] font-medium sm:block ${
                          on ? "text-signal" : "text-ink"
                        }`}
                      >
                        {c.short}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}

        {/* year axis */}
        <div className="grid grid-cols-1 md:grid-cols-[170px_1fr] md:gap-4">
          <div className="hidden md:block" />
          <div className="relative mt-3 h-5 text-[12px] tabular-nums text-pencil">
            {years.map((y, i) => (
              <span
                key={y}
                className={`absolute -translate-x-1/2 ${i % 2 && y !== END ? "hidden sm:inline" : ""}`}
                style={{ left: `${pct(y)}%` }}
              >
                {y === END ? "" : y}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* details of the selected bar */}
      <div className="border-t border-rule bg-sheet px-4 py-4 sm:px-6" aria-live="polite">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-[17px] font-semibold leading-snug">
            {active.role[lang]} <span className="font-normal text-pencil">
              {lang === "vi" ? "tại" : "at"} {active.org}
            </span>
          </p>
          <p className="text-[13px] tabular-nums text-pencil">{fmtRange(active, lang)}</p>
        </div>
        <p className="note mt-2 max-w-[62ch]">{active.note[lang]}</p>
        <p className="mt-3 text-[13px] text-pencil">
          {lang === "vi" ? "Chạm vào từng thanh để xem chi tiết." : "Select a bar to see that role."}
        </p>
      </div>
    </figure>
  );
}
