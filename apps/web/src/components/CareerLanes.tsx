import { career, lanes, type CareerItem } from "@/content/profile";

const START = 2019;
const END = 2027;
const NOW = 2026.88;
const W = 880;
const LABEL_W = 0;
const LANE_H = 64;
const TOP = 28;

const x = (year: number) => LABEL_W + ((year - START) / (END - START)) * (W - LABEL_W);
const laneColor = (lane: number) => `var(--lane${lane})`;

function fmtSpan(item: CareerItem) {
  const y = (v: number) => Math.floor(v).toString();
  return item.end === null ? `${y(item.start)} – now` : `${y(item.start)} – ${y(item.end)}`;
}

/**
 * The career rendered as a dataset: one bar per role, in the lane it belongs to,
 * drifting from business toward data & AI. Study is drawn hollow, work solid.
 */
export function CareerLanes() {
  const years = Array.from({ length: END - START + 1 }, (_, i) => START + i);
  const height = TOP + lanes.length * LANE_H + 8;
  return (
    <figure className="m-0">
      {/* Desktop / tablet: the lane chart */}
      <div className="hidden md:block">
        <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-labelledby="career-title career-desc">
          <title id="career-title">Career timeline, 2019 to now</title>
          <desc id="career-desc">
            {career.map((c) => `${c.org}, ${c.role.en}, ${fmtSpan(c)}`).join(". ")}
          </desc>
          {years.map((yr) => (
            <g key={yr}>
              <line x1={x(yr)} x2={x(yr)} y1={TOP - 6} y2={height} stroke="var(--line)" strokeWidth="1" />
              {yr < END && (
                <text x={x(yr) + 6} y={TOP - 12} fontSize="12" fill="var(--muted)" className="tnum">
                  {yr}
                </text>
              )}
            </g>
          ))}
          <line x1={x(NOW)} x2={x(NOW)} y1={TOP - 6} y2={height} stroke="var(--ink)" strokeDasharray="3 4" />
          {lanes.map((lane, i) => (
            <text key={lane.en} x={6} y={TOP + i * LANE_H + 14} fontSize="12" fontWeight="600" fill={laneColor(i)}>
              {lane.en}
            </text>
          ))}
          {career.map((c) => {
            const x0 = x(c.start);
            const x1 = x(c.end ?? NOW);
            const y = TOP + c.lane * LANE_H + 22;
            const color = laneColor(c.lane);
            const study = c.kind === "study";
            const next = career
              .filter((o) => o.lane === c.lane && o.start > c.start)
              .sort((a, b) => a.start - b.start)[0];
            const room = (next ? x(next.start) : W) - x0 - 10;
            const shortW = c.short.length * 7.6;
            const maxChars = Math.floor((room - shortW - 6) / 6.3);
            const role =
              maxChars >= c.role.en.length
                ? c.role.en
                : maxChars > 8
                  ? c.role.en.slice(0, maxChars - 1).trimEnd() + "…"
                  : "";
            return (
              <g key={c.id}>
                <rect
                  x={x0}
                  y={y}
                  width={Math.max(6, x1 - x0)}
                  height={14}
                  rx={3}
                  fill={study ? "none" : color}
                  stroke={color}
                  strokeWidth={study ? 2 : 0}
                />
                <text x={x0} y={y + 32} fontSize="12.5" fontWeight="600" fill="var(--ink)">
                  {c.short}
                </text>
                {role && (
                  <text x={x0 + shortW + 6} y={y + 32} fontSize="12" fill="var(--muted)">
                    {role}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {/* Phones: the same data as a list */}
      <ol className="md:hidden space-y-3">
        {[...career].reverse().map((c) => (
          <li key={c.id} className="flex gap-3">
            <span
              aria-hidden
              className="mt-1.5 h-3 w-3 shrink-0 rounded-sm"
              style={{
                background: c.kind === "study" ? "transparent" : laneColor(c.lane),
                border: `2px solid ${laneColor(c.lane)}`,
              }}
            />
            <div>
              <p className="font-semibold leading-snug">
                {c.org} <span className="font-normal text-muted">· {fmtSpan(c)}</span>
              </p>
              <p className="text-[14px] text-muted">{c.role.en}</p>
            </div>
          </li>
        ))}
      </ol>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block h-2.5 w-5 rounded-sm bg-muted" /> Work
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block h-2.5 w-5 rounded-sm border-2 border-muted" /> Study
        </span>
      </figcaption>
    </figure>
  );
}
