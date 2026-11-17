import { num } from "@/lib/format";
import type { Metric } from "@/lib/types";

function Spark({ points }: { points: Metric[] }) {
  const W = 120;
  const H = 32;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const d = points
    .map((p, i) => `${i ? "L" : "M"}${((i / (points.length - 1)) * W).toFixed(1)},${(H - 3 - ((p.value - min) / span) * (H - 6)).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden className="mt-1 text-accent">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

/** One readout per metric key: latest value, plus a sparkline when the key was logged over steps. */
export function Metrics({ metrics }: { metrics: Metric[] }) {
  const byKey = new Map<string, Metric[]>();
  for (const m of metrics) byKey.set(m.key, [...(byKey.get(m.key) ?? []), m]);
  const keys = [...byKey.keys()];
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-xl border-l border-t border-line bg-surface sm:grid-cols-3 lg:grid-cols-4">
      {keys.map((k) => {
        const series = [...byKey.get(k)!].sort((a, b) => (a.step ?? 0) - (b.step ?? 0));
        const last = series[series.length - 1];
        return (
          <div key={k} className="min-w-0 border-b border-r border-line px-4 py-3">
            <dt className="truncate text-[13px] text-muted" title={k}>
              {k}
            </dt>
            <dd className="tnum truncate text-[22px] font-bold leading-tight" title={String(last.value)}>
              {num(last.value)}
            </dd>
            {series.length > 1 && (
              <dd className="text-[12px] text-muted">
                <Spark points={series} />
                {series.length} steps
              </dd>
            )}
          </div>
        );
      })}
    </dl>
  );
}
