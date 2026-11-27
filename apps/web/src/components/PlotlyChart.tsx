"use client";

import type { Data, Layout } from "plotly.js";
import { useEffect, useRef, useState } from "react";
import { PALETTE } from "@/lib/chart";

type Figure = { data: unknown[]; layout: Record<string, unknown> };

const AXIS_KEY = /^[xy]axis\d*$/;
const MIN_MARGIN = { l: 56, r: 16, t: 48, b: 48 };

/** Figure height from the agent's layout (e.g. stacked facets), clamped to something sane. */
function figureHeight(layout: Record<string, unknown>): number | null {
  const h = layout.height;
  return typeof h === "number" && Number.isFinite(h) ? Math.min(Math.max(h, 240), 2400) : null;
}

/** The figure's own title, shown as HTML above the plot so it wraps on phones and never collides with a top legend. */
function figureTitle(layout: Record<string, unknown>): string {
  const t = layout.title;
  const text = typeof t === "string" ? t : t && typeof t === "object" ? (t as { text?: unknown }).text : "";
  return typeof text === "string" ? text.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").trim() : "";
}

/** Minimum plot width the figure asks for (lib/chart.ts sets it so every bar stays pointer-sized). */
function figureMinWidth(layout: Record<string, unknown>): number | null {
  const w = (layout.meta as { minWidth?: unknown } | undefined)?.minWidth;
  return typeof w === "number" && Number.isFinite(w) && w > 0 ? Math.min(w, 20000) : null;
}

function themeMode(): "light" | "dark" {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Resolve palette slots (meta.slot, set by lib/chart.ts) to this theme's step of the hue, add the
 * surface-coloured gap between adjacent fills, and give table cells dark text on their light fill.
 */
function themedData(data: unknown[], layout: Record<string, unknown>): unknown[] {
  const fallback = ((layout.font ?? {}) as { color?: unknown }).color;
  const dark = typeof fallback === "string" ? fallback : "#1f1f1f";
  const mode = themeMode();
  const surface = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim() || "#ffffff";
  return data.map((trace) => {
    const t = trace as Record<string, unknown>;
    if (t.type === "table") {
      const cells = (t.cells ?? {}) as Record<string, unknown>;
      const font = (cells.font ?? {}) as Record<string, unknown>;
      return font.color ? trace : { ...t, cells: { ...cells, font: { ...font, color: dark } } };
    }
    const slot = (t.meta as { slot?: number | "other" } | undefined)?.slot;
    if (slot === undefined) return trace;
    const color = slot === "other" ? PALETTE.other : PALETTE[mode][slot % PALETTE[mode].length];
    if (t.type === "bar") return { ...t, marker: { ...(t.marker as object), color, line: { color: surface, width: 1.5 } } };
    const mode_ = String(t.mode ?? "");
    return {
      ...t,
      line: { ...(t.line as object), color, width: 2 },
      marker: { ...(t.marker as object), color, size: mode_ === "markers" ? 9 : 6, line: { color: surface, width: mode_ === "markers" ? 1.5 : 0 } },
      ...(t.stackgroup ? { fillcolor: `${color}99` } : {}),
    };
  });
}

function themed(layout: Record<string, unknown>) {
  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue("--ink").trim();
  const line = css.getPropertyValue("--line").trim();
  const surface = css.getPropertyValue("--surface").trim() || "#ffffff";
  const out: Record<string, unknown> = { ...layout };
  // Every axis, including subplot axes (xaxis2, yaxis5…): theme colours, and let Plotly grow
  // the margins so tick labels are never clipped.
  const keys = new Set(["xaxis", "yaxis", ...Object.keys(layout).filter((k) => AXIS_KEY.test(k))]);
  for (const k of keys) {
    out[k] = { ...(layout[k] as object), gridcolor: line, zerolinecolor: line, linecolor: line, automargin: true };
  }
  const m = (layout.margin ?? {}) as Record<string, unknown>;
  const num = (v: unknown, min: number) => (typeof v === "number" ? Math.max(v, min) : min);
  const font = (layout.font ?? {}) as Record<string, unknown>;
  // The title is drawn as HTML above the plot, so the top margin the figure kept for it is empty
  // space: keep only room for a legend placed on top, and shrink the height by what was removed.
  const legend = (layout.legend ?? {}) as Record<string, unknown>;
  const topLegend = layout.showlegend !== false && typeof legend.y === "number" && legend.y >= 1 && legend.orientation === "h";
  let top = num(m.t, MIN_MARGIN.t);
  let height = figureHeight(layout);
  if (figureTitle(layout) && typeof m.t === "number") {
    const wanted = topLegend ? 44 : 20;
    if (m.t > wanted) {
      top = wanted;
      if (height !== null) height = Math.max(240, height - (m.t - wanted));
    }
  }
  return {
    ...out,
    title: { text: "" },
    autosize: true,
    height: height ?? undefined,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "Be Vietnam Pro, system-ui, sans-serif", size: typeof font.size === "number" ? font.size : 12, color: ink },
    // A unified tooltip (one box listing every series at the hovered X) would otherwise take the
    // transparent paper colour; give it the card surface and text ink.
    hoverlabel: String(layout.hovermode ?? "").includes("unified")
      ? { ...(layout.hoverlabel as object), bgcolor: surface, bordercolor: line, font: { color: ink } }
      : { ...(layout.hoverlabel as object), bgcolor: undefined },
    margin: { ...m, l: num(m.l, MIN_MARGIN.l), r: num(m.r, MIN_MARGIN.r), t: top, b: num(m.b, MIN_MARGIN.b) },
    colorway: PALETTE[themeMode()],
  };
}

/** Renders an uploaded Plotly figure. Plotly is loaded only on pages that need it. */
export function PlotlyChart({ figure, title }: { figure: Figure; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let Plotly: typeof import("plotly.js-dist-min") | null = null;
    const draw = () => {
      if (!Plotly || !ref.current || cancelled) return;
      Plotly.react(ref.current, themedData(figure.data, figure.layout) as Data[], themed(figure.layout) as Partial<Layout>, {
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ["lasso2d", "select2d"],
      });
    };
    import("plotly.js-dist-min")
      .then((mod) => {
        Plotly = (mod as { default?: typeof import("plotly.js-dist-min") }).default ?? mod;
        draw();
      })
      .catch(() => setFailed(true));
    window.addEventListener("themechange", draw);
    const node = ref.current;
    // `responsive` only follows window resizes; also follow the card's own width (a scrollbar
    // appearing, a sidebar opening) so the plot never overflows its box.
    const observer = new ResizeObserver(() => {
      if (Plotly && node && !cancelled && node.querySelector(".main-svg")) Plotly.Plots.resize(node);
    });
    if (node) observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener("themechange", draw);
      if (Plotly && node) Plotly.purge(node);
    };
  }, [figure]);
  if (failed) return <p className="text-muted">The chart library failed to load. Download the JSON instead.</p>;
  const height = figureHeight(figure.layout);
  const heading = figureTitle(figure.layout);
  const minWidth = figureMinWidth(figure.layout);
  return (
    <div>
      {heading && <p className="mb-1 text-sm font-medium leading-snug">{heading}</p>}
      <div className={minWidth ? "overflow-x-auto" : undefined}>
        <div
          ref={ref}
          className={`w-full overflow-hidden ${height ? "" : "h-[380px] md:h-[440px]"}`}
          style={{ ...(height ? { height } : {}), ...(minWidth ? { minWidth } : {}) }}
          role="img"
          aria-label={heading || title}
        />
      </div>
    </div>
  );
}
