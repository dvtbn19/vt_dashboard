import { Marked } from "marked";
import type { Block } from "@/lib/db";
import { PlotlyChart } from "./PlotlyChart";
import { DataTable } from "./DataTable";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Agent-written markdown: render it, but never pass raw HTML through.
const md = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html({ text }) {
      return esc(text);
    },
    link({ href, text }) {
      const safe = /^(https?:|mailto:|\/)/i.test(href) ? href : "#";
      return `<a href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
  },
});

export function Markdown({ content, className = "" }: { content: string; className?: string }) {
  return <div className={`prose-lab ${className}`} dangerouslySetInnerHTML={{ __html: md.parse(content) as string }} />;
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  if (!blocks.length) return null;
  return (
    <div className="flex flex-col gap-8">
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </div>
  );
}

function Caption({ text }: { text?: string }) {
  return text ? <figcaption className="mt-2 px-1 text-[14px] text-pencil">{text}</figcaption> : null;
}

function BlockView({ block: b }: { block: Block }) {
  switch (b.type) {
    case "markdown":
      return <Markdown content={b.content} />;
    case "metrics":
      return (
        <dl className="grid grid-cols-2 border-y border-ink sm:grid-cols-3 lg:grid-cols-4">
          {b.items.map((m, i) => (
            <div key={i} className="border-b border-rule px-1 py-4 pr-4 last:border-b-0 sm:border-b-0">
              <dt className="text-[14px] text-pencil">{m.label}</dt>
              <dd className="mt-1 text-[26px] font-semibold leading-tight tabular-nums">
                {i === 0 ? <mark className="mark">{fmt(m.value)}</mark> : fmt(m.value)}
              </dd>
              {m.delta ? (
                <dd className={`mt-0.5 text-[14px] font-medium tabular-nums ${m.delta.trim().startsWith("-") || m.delta.trim().startsWith("−") ? "text-redpen" : "text-signal"}`}>
                  {m.delta}
                </dd>
              ) : null}
            </div>
          ))}
        </dl>
      );
    case "table":
      return (
        <figure className="sheet overflow-hidden">
          <DataTable columns={b.columns} rows={b.rows} />
          {b.caption ? <figcaption className="border-t border-rule px-4 py-2.5 text-[14px] text-pencil">{b.caption}</figcaption> : null}
        </figure>
      );
    case "plotly":
      return (
        <figure className="sheet p-2 sm:p-4">
          <PlotlyChart figure={b.figure} />
          <Caption text={b.caption} />
        </figure>
      );
    case "image":
      return (
        <figure className="sheet overflow-hidden p-2 sm:p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.url} alt={b.caption ?? "Figure from the analysis"} className="mx-auto h-auto max-h-[760px] w-auto max-w-full rounded-[6px] bg-white" />
          <Caption text={b.caption} />
        </figure>
      );
    case "code":
      return (
        <figure className="overflow-hidden rounded-[10px] border border-rule">
          {b.language ? <figcaption className="border-b border-rule px-4 py-2 text-[13px] text-pencil">{b.language}</figcaption> : null}
          <pre className="overflow-x-auto bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] p-4 font-mono text-[13px] leading-relaxed">
            <code>{b.content}</code>
          </pre>
        </figure>
      );
    case "log":
      return (
        <details className="overflow-hidden rounded-[10px] border border-rule">
          <summary className="cursor-pointer px-4 py-3 text-[14px] font-medium text-pencil hover:text-ink">Show the run log</summary>
          <pre className="max-h-[440px] overflow-auto border-t border-rule bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] p-4 font-mono text-[12.5px] leading-relaxed text-pencil">
            {b.content}
          </pre>
        </details>
      );
    case "file":
      return (
        <a href={b.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-[10px] border border-rule px-4 py-3 hover:border-signal">
          <span className="truncate font-medium">{b.name}</span>
          <span className="flex-none text-[14px] text-signal">Download</span>
        </a>
      );
    default:
      return null;
  }
}

function fmt(v: string | number) {
  if (typeof v === "number") {
    if (Number.isInteger(v)) return v.toLocaleString("en-US");
    return Math.abs(v) < 1 ? v.toFixed(4) : v.toLocaleString("en-US", { maximumFractionDigits: 3 });
  }
  return v;
}
