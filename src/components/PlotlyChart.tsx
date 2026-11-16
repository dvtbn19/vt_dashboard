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
      s.onload = () => (window.Plotly ? resolve(window.Plotly) : reject(new Error("Plotly failed to load")));
      s.onerror = () => {
        loading = null;
        reject(new Error("Plotly failed to load"));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

const darkLayout = {
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(0,0,0,0)",
  font: { color: "#c9cedb", family: "var(--font-geist-sans), system-ui, sans-serif", size: 12 },
  colorway: ["#c8ff3d", "#9b7bff", "#46e0ff", "#ff5c8a", "#ffb547", "#7ee7a8", "#f78fe0"],
  xaxis: { gridcolor: "#222838", zerolinecolor: "#2e3548", linecolor: "#2e3548" },
  yaxis: { gridcolor: "#222838", zerolinecolor: "#2e3548", linecolor: "#2e3548" },
  margin: { l: 56, r: 20, t: 40, b: 48 },
  legend: { bgcolor: "rgba(0,0,0,0)" },
  hoverlabel: { bgcolor: "#11141d", bordercolor: "#2e3548", font: { color: "#eceef4" } },
};

function merge(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over ?? {})) {
    const b = out[k];
    out[k] =
      v && typeof v === "object" && !Array.isArray(v) && b && typeof b === "object" && !Array.isArray(b)
        ? merge(b as Record<string, unknown>, v as Record<string, unknown>)
        : v;
  }
  return out;
}

export function PlotlyChart({ figure }: { figure: { data: unknown[]; layout?: Record<string, unknown> } }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    loadPlotly()
      .then((P) => {
        if (cancelled) return;
        const layout = merge(darkLayout, { ...(figure.layout ?? {}), template: undefined });
        delete layout.template;
        layout.autosize = true;
        return P.newPlot(el, figure.data, layout, { responsive: true, displaylogo: false });
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
      window.Plotly?.purge(el);
    };
  }, [figure]);

  if (error) return <p className="text-sm text-rose">{error}</p>;
  return <div ref={ref} className="min-h-[340px] w-full" />;
}
