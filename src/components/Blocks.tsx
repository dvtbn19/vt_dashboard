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
    <div className="flex flex-col gap-5">
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
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {b.items.map((m, i) => (
            <div key={i} className="panel flex min-w-0 flex-col p-4">
              <dt className="truncate text-[13.5px] text-pencil">{m.label}</dt>
              <dd className="mt-1.5 truncate text-[24px] font-bold leading-tight tracking-[-0.01em] tnum sm:text-[26px]">
                {i === 0 ? <mark className="mark">{fmt(m.value)}</mark> : fmt(m.value)}
              </dd>
              {m.delta ? (
                <dd
                  className={`mt-1 self-start rounded-full px-2 py-0.5 text-[12.5px] font-semibold tnum ${
                    m.delta.trim().startsWith("-") || m.delta.trim().startsWith("−") ? "bg-redpen/12 text-redpen" : "bg-live/12 text-live"
                  }`}
                >
                  {m.delta}
                </dd>
              ) : null}
            </div>
          ))}
        </dl>
      );
    case "table":
      return (
        <figure className="panel overflow-hidden">
          <DataTable columns={b.columns} rows={b.rows} />
          {b.caption ? <figcaption className="border-t border-rule px-4 py-2.5 text-[14px] text-pencil">{b.caption}</figcaption> : null}
        </figure>
      );
    case "plotly":
      return (
        <figure className="panel p-2 sm:p-4">
          <PlotlyChart figure={b.figure} />
          <Caption text={b.caption} />
        </figure>
      );
    case "image":
      return (
        <figure className="panel overflow-hidden p-2 sm:p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.url} alt={b.caption ?? "Figure from the analysis"} className="mx-auto h-auto max-h-[760px] w-auto max-w-full rounded-[6px] bg-white" />
          <Caption text={b.caption} />
        </figure>
      );
    case "code":
      return (
        <figure className="overflow-hidden rounded-[14px] border border-rule">
          {b.language ? <figcaption className="border-b border-rule px-4 py-2 text-[13px] text-pencil">{b.language}</figcaption> : null}
          <pre className="overflow-x-auto bg-raised p-4 font-mono text-[13px] leading-relaxed">
            <code>{b.content}</code>
          </pre>
        </figure>
      );
    case "log":
      return (
        <details className="panel overflow-hidden">
          <summary className="flex min-h-[48px] cursor-pointer items-center px-4 text-[14px] font-medium text-pencil hover:text-ink">Show the run log</summary>
          <pre className="max-h-[440px] overflow-auto border-t border-rule bg-raised p-4 font-mono text-[12.5px] leading-relaxed text-pencil">
            {b.content}
          </pre>
        </details>
      );
    case "file":
      return (
        <a href={b.url} target="_blank" rel="noopener noreferrer" className="panel flex min-h-[52px] items-center justify-between gap-3 px-4 py-3">
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
