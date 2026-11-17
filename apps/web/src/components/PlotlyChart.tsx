"use client";

import type { Data, Layout } from "plotly.js";
import { useEffect, useRef, useState } from "react";

type Figure = { data: unknown[]; layout: Record<string, unknown> };

function themed(layout: Record<string, unknown>) {
  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue("--ink").trim();
  const line = css.getPropertyValue("--line").trim();
  const axis = (a: unknown) => ({ ...(a as object), gridcolor: line, zerolinecolor: line, linecolor: line });
  return {
    ...layout,
    autosize: true,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "Be Vietnam Pro, system-ui, sans-serif", color: ink, size: 12 },
    margin: { l: 56, r: 16, t: 48, b: 56, ...(layout.margin as object) },
    xaxis: axis(layout.xaxis),
    yaxis: axis(layout.yaxis),
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
      Plotly.react(ref.current, figure.data as Data[], themed(figure.layout) as Partial<Layout>, {
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
  return <div ref={ref} className="h-[380px] w-full md:h-[440px]" role="img" aria-label={title} />;
}
