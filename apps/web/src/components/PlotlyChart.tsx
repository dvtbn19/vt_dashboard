"use client";

import type { Data, Layout } from "plotly.js";
import { useEffect, useRef, useState } from "react";

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

/** Table cells keep their own (usually light) fill, so give them dark text unless the figure set a colour. */
function themedData(data: unknown[], layout: Record<string, unknown>): unknown[] {
  const fallback = ((layout.font ?? {}) as { color?: unknown }).color;
  const dark = typeof fallback === "string" ? fallback : "#1f1f1f";
  return data.map((trace) => {
    const t = trace as Record<string, unknown>;
    if (t.type !== "table") return trace;
    const cells = (t.cells ?? {}) as Record<string, unknown>;
    const font = (cells.font ?? {}) as Record<string, unknown>;
    return font.color ? trace : { ...t, cells: { ...cells, font: { ...font, color: dark } } };
  });
}

function themed(layout: Record<string, unknown>) {
  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue("--ink").trim();
  const line = css.getPropertyValue("--line").trim();
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
  return {
    ...out,
    title: { text: "" },
    autosize: true,
    height: figureHeight(layout) ?? undefined,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "Be Vietnam Pro, system-ui, sans-serif", size: typeof font.size === "number" ? font.size : 12, color: ink },
    hoverlabel: { ...(layout.hoverlabel as object), bgcolor: undefined },
    margin: { ...m, l: num(m.l, MIN_MARGIN.l), r: num(m.r, MIN_MARGIN.r), t: num(m.t, MIN_MARGIN.t), b: num(m.b, MIN_MARGIN.b) },
    colorway: ["#414487", "#2a788e", "#22a884", "#7ad151", "#c9b400", "#440154"],
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
    return () => {
      cancelled = true;
      window.removeEventListener("themechange", draw);
      if (Plotly && node) Plotly.purge(node);
    };
  }, [figure]);
  if (failed) return <p className="text-muted">The chart library failed to load. Download the JSON instead.</p>;
  const height = figureHeight(figure.layout);
  const heading = figureTitle(figure.layout);
  return (
    <div>
      {heading && <p className="mb-1 text-sm font-medium leading-snug">{heading}</p>}
      <div
        ref={ref}
        className={`w-full overflow-hidden ${height ? "" : "h-[380px] md:h-[440px]"}`}
        style={height ? { height } : undefined}
        role="img"
        aria-label={heading || title}
      />
    </div>
  );
}
