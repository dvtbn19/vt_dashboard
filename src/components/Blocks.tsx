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

export function Markdown({ content }: { content: string }) {
  return <div className="prose-lab" dangerouslySetInnerHTML={{ __html: md.parse(content) as string }} />;
}

function Caption({ text }: { text?: string }) {
  return text ? <p className="mt-2 text-sm text-muted">{text}</p> : null;
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

function BlockView({ block: b }: { block: Block }) {
  switch (b.type) {
    case "markdown":
      return (
        <section className="card p-5 sm:p-6">
          <Markdown content={b.content} />
        </section>
      );
    case "metrics":
      return (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {b.items.map((m, i) => (
            <div key={i} className="card p-4">
              <div className="label">{m.label}</div>
              <div className="mt-2 font-mono text-2xl tabular-nums text-fg">{fmt(m.value)}</div>
              {m.delta ? (
                <div className={`mt-1 font-mono text-xs ${m.delta.trim().startsWith("-") ? "text-rose" : "text-lime"}`}>{m.delta}</div>
              ) : null}
            </div>
          ))}
        </section>
      );
    case "table":
      return (
        <section className="card overflow-hidden">
          <DataTable columns={b.columns} rows={b.rows} />
          {b.caption ? <p className="border-t border-line px-4 py-2 text-sm text-muted">{b.caption}</p> : null}
        </section>
      );
    case "plotly":
      return (
        <section className="card p-3 sm:p-4">
          <PlotlyChart figure={b.figure} />
          <Caption text={b.caption} />
        </section>
      );
    case "image":
      return (
        <figure className="card overflow-hidden p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.url} alt={b.caption ?? "analysis figure"} className="mx-auto max-h-[720px] w-auto rounded-lg bg-white" />
          {b.caption ? <figcaption className="mt-2 px-1 text-sm text-muted">{b.caption}</figcaption> : null}
        </figure>
      );
    case "code":
      return (
        <section className="card overflow-hidden">
          {b.language ? <div className="label border-b border-line px-4 py-2">{b.language}</div> : null}
          <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-fg/90">
            <code>{b.content}</code>
          </pre>
        </section>
      );
    case "log":
      return (
        <details className="card overflow-hidden">
          <summary className="label cursor-pointer px-4 py-3">log</summary>
          <pre className="max-h-[420px] overflow-auto border-t border-line bg-ink-2 p-4 font-mono text-xs leading-relaxed text-muted">
            {b.content}
          </pre>
        </details>
      );
    case "file":
      return (
        <a href={b.url} target="_blank" rel="noopener noreferrer" className="card flex items-center justify-between gap-3 p-4 hover:border-lime">
          <span className="font-mono text-sm">{b.name}</span>
          <span className="label">download ↗</span>
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
