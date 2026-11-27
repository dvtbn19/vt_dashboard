import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders untrusted Markdown. Raw HTML is dropped (skipHtml), dangerous URL schemes are removed by
 * react-markdown's default urlTransform, and images are shown as links so a report cannot make the
 * viewer's browser fetch arbitrary remote URLs.
 */
const components: Components = {
  // Tables scroll sideways on their own instead of widening the page; see .prose-lab in globals.css.
  table: ({ children }) => (
    <div className="table-scroll" tabIndex={0} role="region" aria-label="Table">
      <table>{children}</table>
    </div>
  ),
  th: ({ children, style }) => (
    <th style={style}>
      <span className="cell">{children}</span>
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style}>
      <span className="cell">{children}</span>
    </td>
  ),
  a: ({ href, children }) => (
    <a href={href} rel="noopener noreferrer nofollow" target="_blank">
      {children}
    </a>
  ),
  img: ({ src, alt }) =>
    typeof src === "string" && src ? (
      <a href={src} rel="noopener noreferrer nofollow" target="_blank">
        [image: {alt || src}]
      </a>
    ) : null,
};

export function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-lab">
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
