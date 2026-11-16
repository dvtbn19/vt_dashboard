"use client";

import { useEffect, useRef, useState } from "react";

type PlotlyLike = {
  newPlot: (el: HTMLElement, data: unknown[], layout: Record<string, unknown>, config: Record<string, unknown>) => Promise<unknown>;
  purge: (el: HTMLElement) => void;
};

declare global {
  interface Window {
    Plotly?: PlotlyLike;
  }
}

const SRC = "https://cdn.plot.ly/plotly-2.35.2.min.js";
let loading: Promise<PlotlyLike> | null = null;

function loadPlotly(): Promise<PlotlyLike> {
  if (window.Plotly) return Promise.resolve(window.Plotly);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SRC;
      s.async = true;
      s.onload = () => (window.Plotly ? resolve(window.Plotly) : reject(new Error("The chart library didn't load.")));
      s.onerror = () => {
        loading = null;
        reject(new Error("The chart library didn't load. Check the connection and reload the page."));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

/** Reads the design tokens so charts match light and dark mode. */
function themeLayout(el: HTMLElement) {
  const cs = getComputedStyle(el);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  // A fresh object per axis: Plotly mutates layout axes, so sharing one leaks x's type into y.
  const axis = () => ({ gridcolor: v("--rule"), zerolinecolor: v("--rule"), linecolor: v("--rule"), tickcolor: v("--rule") });
  return {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: v("--ink"), family: cs.fontFamily, size: 13 },
    colorway: [1, 2, 3, 4, 5, 6].map((i) => v(`--chart-${i}`)),
    xaxis: axis(),
    yaxis: axis(),
    margin: { l: 56, r: 16, t: 40, b: 84 },
    // Below the x-axis title, not on top of it
    legend: { bgcolor: "rgba(0,0,0,0)", orientation: "h", x: 0, xanchor: "left", y: -0.28, yanchor: "top" },
    hoverlabel: { bgcolor: v("--sheet"), bordercolor: v("--rule"), font: { color: v("--ink") } },
  };
}

function merge(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, val] of Object.entries(over ?? {})) {
    const b = out[k];
    out[k] =
      val && typeof val === "object" && !Array.isArray(val) && b && typeof b === "object" && !Array.isArray(b)
        ? merge(b as Record<string, unknown>, val as Record<string, unknown>)
        : val;
  }
  return out;
}

export function PlotlyChart({ figure }: { figure: { data: unknown[]; layout?: Record<string, unknown> } }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const draw = () =>
      loadPlotly()
        .then((P) => {
          if (cancelled) return;
          const userLayout = { ...(figure.layout ?? {}) };
          delete userLayout.template; // plotly's own templates fight the page theme
          const layout = merge(themeLayout(el), userLayout);
          layout.autosize = true;
          return P.newPlot(el, figure.data, layout, { responsive: true, displaylogo: false }).then(() => setReady(true));
        })
        .catch((e: Error) => setError(e.message));
    draw();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", draw);
    return () => {
      cancelled = true;
      mq.removeEventListener("change", draw);
      window.Plotly?.purge(el);
    };
  }, [figure]);

  if (error) return <p className="text-[15px] text-redpen">{error}</p>;
  return (
    <div className="relative">
      {!ready ? <p className="absolute inset-0 grid place-items-center text-[14px] text-pencil">Drawing chart…</p> : null}
      <div ref={ref} className="min-h-[340px] w-full" />
    </div>
  );
}
