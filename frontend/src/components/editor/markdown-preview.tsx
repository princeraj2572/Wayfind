import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/** On pages that already have an h1 (the read-only viewer) body headings start at h2. */
const DEMOTED_HEADINGS: Components = {
  h1: ({ node, ...rest }) => {
    void node;
    return <h2 {...rest} />;
  },
  h2: ({ node, ...rest }) => {
    void node;
    return <h3 {...rest} />;
  },
  h3: ({ node, ...rest }) => {
    void node;
    return <h4 {...rest} />;
  },
  h4: ({ node, ...rest }) => {
    void node;
    return <h5 {...rest} />;
  },
  h5: ({ node, ...rest }) => {
    void node;
    return <h6 {...rest} />;
  },
};

/** Renders markdown without raw HTML (react-markdown escapes it by default). */
export function MarkdownPreview({ text, demoteHeadings = false }: { text: string; demoteHeadings?: boolean }) {
  if (!text.trim()) return <p className="text-sm text-mute">Nothing to preview yet.</p>;
  return (
    <div className="md-preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          ...(demoteHeadings ? DEMOTED_HEADINGS : {}),
          a: ({ node, ...rest }) => {
            void node;
            return <a {...rest} target="_blank" rel="noopener noreferrer" />;
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
