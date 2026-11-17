import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders untrusted Markdown. Raw HTML is dropped (skipHtml), dangerous URL schemes are removed by
 * react-markdown's default urlTransform, and images are shown as links so a report cannot make the
 * viewer's browser fetch arbitrary remote URLs.
 */
const components: Components = {
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
