/**
 * Chart builder in the spirit of Tableau's shelves: a mark type, a dimension on X, measures with an
 * aggregation, an optional Color dimension, optional small multiples, value filters and sorting.
 * Produces a Plotly figure whose trace colours are palette *slots* (meta.slot); PlotlyChart resolves
 * the slot to the light or dark step of the same hue at draw time.
 */
import type { Cell, ChartAgg, ChartFilter, ChartSpec, FilterValue, QueryResult } from "./types";

/** Facet value meaning "one panel per measure" (Tableau's Measure Names). */
export const MEASURES = "@measures";
/** Categorical hues, fixed order (validated for CVD separation on the app's light and dark surfaces). */
export const PALETTE = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9", "#e66767"],
  other: "#898781",
};
const MAX_SERIES = PALETTE.light.length; // past this, the smallest fold into "Other"
const MAX_PANELS = 24;
/** Thinnest bar drawn, in px: about the size of a mouse pointer. */
const MIN_BAR_PX = 24;
const BAR_GAP = 0.25;
export const MAX_FILTER_VALUES = 500;

export const AGG_LABEL: Record<ChartAgg, string> = {
  sum: "Sum",
  avg: "Average",
  min: "Min",
  max: "Max",
  count: "Count",
  none: "None (every row)",
};

export const key = (v: Cell): string => (v === null ? "∅" : typeof v === "object" ? JSON.stringify(v) : String(v));
const label = (v: Cell): string => (v === null ? "(null)" : key(v));

/** Columns whose non-null values are all numbers (candidates for measures). */
export function numericColumns(r: QueryResult): string[] {
  return r.columns.filter((_, i) => {
    let seen = false;
    for (const row of r.rows) {
      const v = row[i];
      if (v === null) continue;
      if (typeof v !== "number") return false;
      seen = true;
    }
    return seen;
  });
}

/** Distinct values of a column with row counts, in first-appearance order; null if there are too many. */
export function distinctValues(r: QueryResult, column: string, limit = MAX_FILTER_VALUES): { value: FilterValue; count: number }[] | null {
  const i = r.columns.indexOf(column);
  if (i < 0) return [];
  const m = new Map<string, { value: FilterValue; count: number }>();
  for (const row of r.rows) {
    const v = row[i];
    const k = key(v);
    const e = m.get(k);
    if (e) e.count++;
    else {
      if (m.size >= limit) return null;
      m.set(k, { value: typeof v === "object" && v !== null ? JSON.stringify(v) : (v as FilterValue), count: 1 });
    }
  }
  return [...m.values()];
}

export function applyFilters(r: QueryResult, filters: ChartFilter[] | undefined): Cell[][] {
  const active = (filters ?? [])
    .map((f) => ({ i: r.columns.indexOf(f.column), keep: new Set(f.values.map((v) => key(v as Cell))) }))
    .filter((f) => f.i >= 0);
  if (!active.length) return r.rows;
  return r.rows.filter((row) => active.every((f) => f.keep.has(key(row[f.i]))));
}

function reduce(values: number[], agg: ChartAgg): number | null {
  if (agg === "count") return values.length;
  const nums = values.filter((v) => Number.isFinite(v));
  if (!nums.length) return null;
  switch (agg) {
    case "avg":
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    case "min":
      return Math.min(...nums);
    case "max":
      return Math.max(...nums);
    default:
      return nums.reduce((a, b) => a + b, 0);
  }
}

const ISO_DATE = /^\d{4}-\d{2}(-\d{2})?([ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
function axisType(values: Cell[]): "linear" | "date" | "category" {
  const present = values.filter((v) => v !== null);
  if (!present.length) return "category";
  if (present.every((v) => typeof v === "number")) return "linear";
  if (present.every((v) => typeof v === "string" && ISO_DATE.test(v))) return "date";
  return "category";
}

const naturalCompare = new Intl.Collator("en", { numeric: true, sensitivity: "base" }).compare;

/** Keep a saved chart only if its columns still exist in the result; drop parts that no longer apply. */
export function usableChart(spec: ChartSpec | null, r: QueryResult): ChartSpec | null {
  if (!spec || !r.columns.includes(spec.x)) return null;
  const y = spec.y.filter((c) => r.columns.includes(c));
  if (!y.length) return null;
  const has = (c: string | null | undefined) => !!c && (c === MEASURES || r.columns.includes(c));
  return {
    ...spec,
    y,
    color: spec.color && r.columns.includes(spec.color) ? spec.color : null,
    facet: has(spec.facet) ? spec.facet : null,
    filters: (spec.filters ?? []).filter((f) => r.columns.includes(f.column)),
  };
}

/** A reasonable first chart: first text column on X, up to three numeric measures (summed). */
export function defaultChart(r: QueryResult): ChartSpec | null {
  const nums = numericColumns(r);
  if (!nums.length || !r.columns.length) return null;
  const x = r.columns.find((c) => !nums.includes(c)) ?? r.columns[0];
  const y = nums.filter((c) => c !== x).slice(0, 3);
  if (!y.length) return null;
  // Measures on very different scales (e.g. cm and %) get one panel each instead of sharing an axis.
  const maxAbs = y.map((c) => {
    const i = r.columns.indexOf(c);
    return Math.max(0, ...r.rows.map((row) => Math.abs(Number(row[i]) || 0)));
  });
  const spread = Math.max(...maxAbs) / Math.max(1e-9, Math.min(...maxAbs.filter((m) => m > 0)));
  return { type: "bar", x, y, agg: "sum", facet: y.length > 1 && spread > 20 ? MEASURES : null, sort: "none", barmode: "group" };
}

export type ChartInfo = {
  /** Colour values folded into "Other" (beyond the palette's eight slots). */
  folded: number;
  colorValues: number;
  /** Panels not drawn (beyond MAX_PANELS). */
  hiddenPanels: number;
  /** With Color + a facet column, only the first measure is drawn. */
  measuresDropped: number;
  rows: number;
};

type Figure = { data: Record<string, unknown>[]; layout: Record<string, unknown> };

export function figureFor(spec: ChartSpec, r: QueryResult): Figure {
  return buildChart(spec, r).figure;
}

type ColorScale = { colorOf: (v: Cell) => string; order: string[]; folded: number; values: number };

/** Colour values: the (MAX_SERIES - 1) largest by total |measure| keep a hue, the rest fold into "Other". */
function colorScale(rows: Cell[][], ci: number, mi: number, agg: ChartAgg): ColorScale {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const k = label(row[ci]);
    totals.set(k, (totals.get(k) ?? 0) + (agg === "count" ? 1 : Math.abs(Number(row[mi]) || 0)));
  }
  const all = [...totals.keys()];
  let kept = all;
  let folded = 0;
  if (all.length > MAX_SERIES) {
    kept = [...all].sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0)).slice(0, MAX_SERIES - 1);
    folded = all.length - kept.length;
  }
  // Slots follow the value (alphabetical), not its rank, so a filter does not repaint the survivors.
  const order = [...kept].sort(naturalCompare);
  if (folded) order.push("Other");
  const keptSet = new Set(kept);
  return { colorOf: (v: Cell) => (keptSet.has(label(v)) ? label(v) : "Other"), order, folded, values: all.length };
}

export function buildChart(spec: ChartSpec, r: QueryResult): { figure: Figure; info: ChartInfo } {
  const agg: ChartAgg = spec.agg ?? "none";
  const type = spec.type;
  const horizontal = type === "hbar";
  const rows = applyFilters(r, spec.filters);
  const col = (c: string) => r.columns.indexOf(c);
  const xi = col(spec.x);
  const colorCol = spec.color && spec.color !== spec.x ? spec.color : null;
  const ci = colorCol ? col(colorCol) : -1;
  let facet = spec.facet ?? null;
  // Color and several measures: show every measure as its own panel (unless the user chose another split).
  if (colorCol && spec.y.length > 1 && !facet) facet = MEASURES;
  const fi = facet && facet !== MEASURES ? col(facet) : -1;
  const measures = colorCol && facet && facet !== MEASURES ? spec.y.slice(0, 1) : spec.y;
  const info: ChartInfo = { folded: 0, colorValues: 0, hiddenPanels: 0, measuresDropped: spec.y.length - measures.length, rows: rows.length };

  // ---- panels
  type Panel = { title: string; rows: Cell[][]; measures: string[] };
  let panels: Panel[];
  if (facet === MEASURES) panels = measures.map((m) => ({ title: m, rows, measures: [m] }));
  else if (fi >= 0) {
    const groups = new Map<string, Cell[][]>();
    for (const row of rows) {
      const k = label(row[fi]);
      const g = groups.get(k);
      if (g) g.push(row);
      else groups.set(k, [row]);
    }
    panels = [...groups.entries()].map(([title, g]) => ({ title, rows: g, measures }));
  } else panels = [{ title: "", rows, measures }];
  if (panels.length > MAX_PANELS) {
    info.hiddenPanels = panels.length - MAX_PANELS;
    panels = panels.slice(0, MAX_PANELS);
  }

  // ---- colour scales. When each colour value lives in a single panel (e.g. brands inside their
  // category), every panel gets its own scale and legend, so nothing needlessly folds into "Other".
  let scales: ColorScale[] = [];
  let perPanel = false;
  if (colorCol) {
    const mi = col(measures[0]);
    if (fi >= 0 && panels.length > 1) {
      const owner = new Map<string, number>();
      perPanel = panels.every((p, pi) =>
        p.rows.every((row) => {
          const k = label(row[ci]);
          const o = owner.get(k);
          if (o === undefined) owner.set(k, pi);
          return o === undefined || o === pi;
        }),
      );
    }
    if (perPanel) scales = panels.map((p) => colorScale(p.rows, ci, mi, agg));
    else scales = [colorScale(rows, ci, mi, agg)];
    info.folded = scales.reduce((a, sc) => a + sc.folded, 0);
    info.colorValues = scales.reduce((a, sc) => a + sc.values, 0);
  }

  const xType = axisType(rows.map((row) => row[xi]));
  const categorical = xType === "category" || (agg !== "none" && xType !== "date" && type !== "scatter" && type !== "line" && type !== "area");
  const data: Record<string, unknown>[] = [];
  const layout: Record<string, unknown> = {};
  const annotations: Record<string, unknown>[] = [];
  const legendNames = new Set<string>();
  const aggName = (m: string) => (agg === "none" ? m : agg === "count" ? "Count of rows" : `${AGG_LABEL[agg]} of ${m}`);
  const catCounts: number[] = [];
  const seriesCounts: number[] = [];
  // Side-by-side bars reserve a slot per colour at every X; when each X has a single colour
  // (a SKU belongs to one brand), draw them full width instead.
  let xSingleColor = true;
  if (colorCol) {
    const seen = new Map<string, string>();
    for (const row of rows) {
      const k = `${fi >= 0 ? label(row[fi]) : ""}|${key(row[xi])}`;
      const c = label(row[ci]);
      const prev = seen.get(k);
      if (prev !== undefined && prev !== c) {
        xSingleColor = false;
        break;
      }
      seen.set(k, c);
    }
  }

  panels.forEach((p, pi) => {
    const n = pi === 0 ? "" : String(pi + 1);
    const xa = `x${n}`;
    const ya = `y${n}`;
    const scale = scales.length ? scales[perPanel ? pi : 0] : null;
    type Series = { name: string; slot: number | "other"; measure: string; rows: Cell[][] };
    let series: Series[];
    if (scale) {
      const by = new Map<string, Cell[][]>();
      for (const row of p.rows) {
        const k = scale.colorOf(row[ci]);
        const g = by.get(k);
        if (g) g.push(row);
        else by.set(k, [row]);
      }
      series = scale.order
        .filter((k) => by.has(k))
        .map((k) => ({ name: k, slot: k === "Other" && scale.folded ? "other" : scale.order.indexOf(k), measure: p.measures[0], rows: by.get(k)! }));
    } else {
      series = p.measures.map((m) => {
        const i = spec.y.indexOf(m);
        return { name: m, slot: i < MAX_SERIES ? i : "other", measure: m, rows: p.rows };
      });
    }

    // dimension order for the panel
    const fmi = col(p.measures[0]);
    const xTotals = new Map<string, { v: Cell; total: number }>();
    for (const row of p.rows) {
      const k = key(row[xi]);
      const e = xTotals.get(k) ?? { v: row[xi], total: 0 };
      e.total += agg === "count" ? 1 : Number(row[fmi]) || 0;
      xTotals.set(k, e);
    }
    let xs = [...xTotals.values()];
    if (spec.sort === "desc") xs = xs.sort((a, b) => b.total - a.total);
    else if (spec.sort === "asc") xs = xs.sort((a, b) => a.total - b.total);
    else if (xType !== "category") xs = xs.sort((a, b) => (a.v! < b.v! ? -1 : a.v! > b.v! ? 1 : 0));
    catCounts.push(xs.length);
    seriesCounts.push(series.length);

    const legendId = perPanel ? `legend${n}` : "legend";
    for (const s of series) {
      const mi = col(s.measure);
      let px: Cell[];
      let py: (number | null)[];
      if (agg === "none") {
        px = s.rows.map((row) => row[xi]);
        py = s.rows.map((row) => (typeof row[mi] === "number" ? (row[mi] as number) : null));
      } else {
        const groups = new Map<string, number[]>();
        for (const row of s.rows) {
          const k = key(row[xi]);
          const g = groups.get(k) ?? [];
          g.push(Number(row[mi]));
          groups.set(k, g);
        }
        const present = xs.filter((x) => groups.has(key(x.v)));
        px = present.map((x) => x.v);
        py = present.map((x) => reduce(groups.get(key(x.v))!, agg));
      }
      const dims = categorical ? px.map(label) : px;
      const legendKey = `${legendId}:${s.name}`;
      const showlegend = !legendNames.has(legendKey);
      legendNames.add(legendKey);
      const valueFmt = (axis: string) => (agg === "count" ? `%{${axis}:,}` : `%{${axis}:,.4~f}`);
      const t: Record<string, unknown> = { name: s.name, legendgroup: legendKey, showlegend, legend: legendId, meta: { slot: s.slot }, xaxis: xa, yaxis: ya };
      if (type === "bar" || type === "hbar") {
        Object.assign(t, {
          type: "bar",
          orientation: horizontal ? "h" : "v",
          x: horizontal ? py : dims,
          y: horizontal ? dims : py,
          // Unified hover: the tooltip's title is the category, each line one series.
          hovertemplate: `%{fullData.name}: <b>${valueFmt(horizontal ? "x" : "y")}</b><extra></extra>`,
        });
      } else {
        Object.assign(t, {
          type: "scatter",
          mode: type === "scatter" ? "markers" : type === "area" ? "lines" : "lines+markers",
          x: dims,
          y: py,
          hovertemplate:
            type === "scatter"
              ? `<b>%{fullData.name}</b><br>${spec.x}: %{x}<br>${aggName(s.measure)}: ${valueFmt("y")}<extra></extra>`
              : `%{fullData.name}: <b>${valueFmt("y")}</b><extra></extra>`,
        });
        if (type === "area") {
          t.stackgroup = `p${pi}`;
          if (spec.barmode === "percent") t.groupnorm = "percent";
        }
      }
      data.push(t);
    }

    const catAxis: Record<string, unknown> = categorical
      ? { type: "category", categoryorder: "array", categoryarray: xs.map((x) => label(x.v)) }
      : { type: xType };
    const dimAxisKey = horizontal ? `yaxis${n}` : `xaxis${n}`;
    const valAxisKey = horizontal ? `xaxis${n}` : `yaxis${n}`;
    layout[dimAxisKey] = {
      ...catAxis,
      ...(horizontal ? { autorange: "reversed" } : {}),
      anchor: horizontal ? xa : ya,
      title: panels.length === 1 ? { text: spec.x } : undefined,
    };
    layout[valAxisKey] = {
      zeroline: true,
      anchor: horizontal ? ya : xa,
      ...(facet !== MEASURES && pi > 0 ? { matches: horizontal ? "x" : "y" } : {}),
      ...(spec.barmode === "percent" ? { ticksuffix: "%" } : {}),
      title:
        panels.length === 1 || facet === MEASURES
          ? { text: scale || p.measures.length === 1 ? aggName(p.measures[0]) : agg === "none" ? "" : AGG_LABEL[agg] }
          : undefined,
    };
  });

  // ---- layout: panels stacked top to bottom with fixed pixel heights
  const multi = panels.length > 1;
  const sharedLegend = !perPanel && legendNames.size > 1;
  const TOP = sharedLegend ? 26 * Math.ceil(legendNames.size / 5) + 16 : 16;
  const BOTTOM = 56;
  const GAP = multi ? (perPanel ? 92 : 78) : 0; // room for tick labels, the panel title and its legend
  // Every bar is at least MIN_BAR_PX thick (about a mouse pointer), so it can be seen and hovered:
  // grouped bars share a category's band, so the band grows with the number of bars in it.
  const isBar = type === "bar" || type === "hbar";
  const barmode = spec.barmode === "stack" || spec.barmode === "percent" || (colorCol && xSingleColor) ? "relative" : "group";
  const barsPerCat = (i: number) => (isBar && barmode === "group" ? Math.max(1, seriesCounts[i]) : 1);
  const bandPx = (i: number) => (barsPerCat(i) * MIN_BAR_PX) / (1 - BAR_GAP);
  const panelPx = panels.map((_, i) =>
    horizontal ? Math.max(120, Math.min(catCounts[i], 60) * bandPx(i) + 20) : multi ? 200 : 360,
  );
  const plotPx = panelPx.reduce((a, b) => a + b, 0) + GAP * Math.max(0, panels.length - 1) + (multi ? 28 : 0);
  let cursor = multi ? 28 : 0; // px from the top of the plot area
  panels.forEach((p, pi) => {
    const n = pi === 0 ? "" : String(pi + 1);
    const top = 1 - cursor / plotPx;
    const bottom = 1 - (cursor + panelPx[pi]) / plotPx;
    cursor += panelPx[pi] + GAP;
    if (!multi) return;
    const dimKey = horizontal ? `yaxis${n}` : `xaxis${n}`;
    const valKey = horizontal ? `xaxis${n}` : `yaxis${n}`;
    const yKey = horizontal ? dimKey : valKey;
    layout[yKey] = { ...(layout[yKey] as object), domain: [Math.max(0, bottom), Math.min(1, top)] };
    const titleY = Math.min(1, top) + 6 / plotPx;
    annotations.push({ text: `<b>${p.title}</b>`, xref: "paper", yref: "paper", x: 0, y: titleY, xanchor: "left", yanchor: "bottom", showarrow: false, font: { size: 13 } });
    if (perPanel) {
      layout[`legend${n}`] = { orientation: "h", x: 1, xanchor: "right", y: titleY, yanchor: "bottom", yref: "paper", font: { size: 12 } };
    }
  });

  Object.assign(layout, {
    barmode,
    barnorm: spec.barmode === "percent" && (type === "bar" || type === "hbar") ? "percent" : undefined,
    bargap: BAR_GAP,
    bargroupgap: 0.08,
    showlegend: perPanel || legendNames.size > 1,
    ...(perPanel ? {} : { legend: sharedLegend ? { orientation: "h", x: 0, xanchor: "left", y: 1, yanchor: "bottom", yref: "paper" } : { visible: false } }),
    // Hover anywhere in a category's column (row, for horizontal bars) lists every series there,
    // so short or zero-height bars and thin lines can still be read. Scatter keeps nearest-point hover.
    hovermode: type === "scatter" ? "closest" : horizontal ? "y unified" : "x unified",
    annotations,
    margin: { t: TOP, b: BOTTOM },
  });
  if (multi || horizontal) layout.height = Math.min(2400, plotPx + TOP + BOTTOM + 8);
  // Vertical bars: the plot is never narrower than its bars need; PlotlyChart scrolls sideways instead.
  if (isBar && !horizontal && categorical) {
    const need = Math.max(...panels.map((_, i) => Math.min(catCounts[i], 200) * bandPx(i)));
    if (Number.isFinite(need)) layout.meta = { minWidth: Math.ceil(need + 96) };
  }
  return { figure: { data, layout }, info };
}
