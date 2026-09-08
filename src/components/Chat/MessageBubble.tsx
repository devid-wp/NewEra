import { memo } from "react";
import ReactMarkdown from "react-markdown";
import { Check, Copy } from "lucide-react";
import { useState, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(code).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="btn-press flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 active:bg-zinc-800 transition-colors px-1.5 py-0.5 rounded"
      title="Copy code"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

type Segment = { type: "text"; content: string } | { type: "math"; latex: string; display: boolean };

function splitByMathDelimiters(text: string): Segment[] {
  const segments: Segment[] = [];
  // Match display math \[...\] first, then inline math \(...\)
  const regex = /\\\[(.+?)\\\]|\\\((.+?)\\\)/gs;
  let lastIndex = 0;

  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      segments.push({ type: "math", latex: match[1].trim(), display: true });
    } else if (match[2] !== undefined) {
      segments.push({ type: "math", latex: match[2].trim(), display: false });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  return segments;
}

export function hasMathDelimiters(text: string): boolean {
  return /\\\[.+?\\\]|\\\(.+?\\\)/s.test(text);
}

function KaTeXSegment({ latex, display }: { latex: string; display: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);

  // Render KaTeX once on mount/update
  const renderedRef = useRef<string>("");
  if (ref.current && renderedRef.current !== latex) {
    try {
      katex.render(latex, ref.current, {
        displayMode: display,
        throwOnError: false,
        trust: true,
      });
      renderedRef.current = latex;
    } catch {
      ref.current.textContent = latex;
    }
  }

  return <span ref={ref} />;
}

function splitPreservingCodeBlocks(text: string): string[] {
  // Split content so that code blocks (```...```) are kept as single chunks
  // and not processed for math delimiters
  const parts: string[] = [];
  const codeBlockRegex = /(```[\s\S]*?```)/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(match[1]);
    lastIndex = codeBlockRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

type Props = {
  content: string;
  streaming?: boolean;
};

export const Markdown = memo(function Markdown({ content, streaming }: Props) {
  // Pre-process: extract math segments and replace with placeholders,
  // then let ReactMarkdown handle normal markdown, then restore math
  const mathMap = new Map<string, React.ReactNode>();
  let mathIndex = 0;

  const processedContent = (() => {
    const parts = splitPreservingCodeBlocks(content);
    return parts
      .map((part) => {
        if (part.startsWith("```")) return part;
        const segments = splitByMathDelimiters(part);
        return segments
          .map((seg) => {
            if (seg.type === "math") {
              const key = `__MATH_${mathIndex++}__`;
              mathMap.set(key, <KaTeXSegment latex={seg.latex} display={seg.display} />);
              return key;
            }
            return seg.content;
          })
          .join("");
      })
      .join("");
  })();

  // If there's no math, render normally
  if (mathMap.size === 0) {
    return (
      <div>
        <ReactMarkdown
          components={{
            pre: ({ children, node }: any) => {
              const code = node?.children?.[0]?.children?.[0]?.value ?? "";
              return (
                <div className="relative group my-2">
                  <div className="flex items-center justify-between bg-zinc-950 border border-b-0 border-zinc-800 rounded-t-lg px-3 py-1">
                    <span className="text-[11px] text-zinc-500 font-mono">code</span>
                    {code ? <CopyButton code={code} /> : null}
                  </div>
                  <pre className="bg-zinc-950 border border-zinc-800 rounded-b-lg p-3 overflow-x-auto text-[13px] leading-relaxed">
                    {children}
                  </pre>
                </div>
              );
            },
            code: ({ inline, className, children, ...props }: any) => {
              const isBlock = !inline;
              return (
                <code
                  className={
                    isBlock
                      ? "block text-[13px] text-zinc-100 font-mono whitespace-pre"
                      : "bg-zinc-800 text-pink-300 rounded px-1 py-0.5 text-[0.85em] font-mono"
                  }
                  {...props}
                >
                  {children}
                </code>
              );
            },
            a: ({ href, children }) => (
              <a href={href} className="text-blue-400 underline" target="_blank" rel="noreferrer">
                {children}
              </a>
            ),
            ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
            h1: ({ children }) => <h1 className="text-lg font-semibold my-2">{children}</h1>,
            h2: ({ children }) => <h2 className="text-base font-semibold my-2">{children}</h2>,
            h3: ({ children }) => <h3 className="text-sm font-semibold my-1.5">{children}</h3>,
            strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
            em: ({ children }) => <em>{children}</em>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-zinc-700 pl-3 my-2 text-zinc-400 italic">
                {children}
              </blockquote>
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto my-2">
                <table className="border-collapse text-sm">{children}</table>
              </div>
            ),
            th: ({ children }) => (
              <th className="border border-zinc-700 px-2 py-1 font-semibold text-left">{children}</th>
            ),
            td: ({ children }) => <td className="border border-zinc-700 px-2 py-1">{children}</td>,
          }}
        >
          {content}
        </ReactMarkdown>
        {streaming && <span className="inline-block w-2 h-4 bg-zinc-500 ml-1 animate-pulse align-middle" />}
      </div>
    );
  }

  // Has math — render with placeholders, then swap in KaTeX components
  return (
    <div>
      <ReactMarkdown
        components={{
          pre: ({ children, node }: any) => {
            const code = node?.children?.[0]?.children?.[0]?.value ?? "";
            return (
              <div className="relative group my-2">
                <div className="flex items-center justify-between bg-zinc-950 border border-b-0 border-zinc-800 rounded-t-lg px-3 py-1">
                  <span className="text-[11px] text-zinc-500 font-mono">code</span>
                  {code ? <CopyButton code={code} /> : null}
                </div>
                <pre className="bg-zinc-950 border border-zinc-800 rounded-b-lg p-3 overflow-x-auto text-[13px] leading-relaxed">
                  {children}
                </pre>
              </div>
            );
          },
          code: ({ inline, className, children, ...props }: any) => {
            const isBlock = !inline;
            return (
              <code
                className={
                  isBlock
                    ? "block text-[13px] text-zinc-100 font-mono whitespace-pre"
                    : "bg-zinc-800 text-pink-300 rounded px-1 py-0.5 text-[0.85em] font-mono"
                }
                {...props}
              >
                {children}
              </code>
            );
          },
          a: ({ href, children }) => (
            <a href={href} className="text-blue-400 underline" target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          p: ({ children }) => (
            <p className="my-1.5 leading-relaxed">
              {replaceMathPlaceholders(children, mathMap)}
            </p>
          ),
          h1: ({ children }) => (
            <h1 className="text-lg font-semibold my-2">{replaceMathPlaceholders(children, mathMap)}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold my-2">{replaceMathPlaceholders(children, mathMap)}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold my-1.5">{replaceMathPlaceholders(children, mathMap)}</h3>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{replaceMathPlaceholders(children, mathMap)}</strong>
          ),
          em: ({ children }) => <em>{replaceMathPlaceholders(children, mathMap)}</em>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-zinc-700 pl-3 my-2 text-zinc-400 italic">
              {replaceMathPlaceholders(children, mathMap)}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-zinc-700 px-2 py-1 font-semibold text-left">
              {replaceMathPlaceholders(children, mathMap)}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-zinc-700 px-2 py-1">
              {replaceMathPlaceholders(children, mathMap)}
            </td>
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
      {streaming && <span className="inline-block w-2 h-4 bg-zinc-500 ml-1 animate-pulse align-middle" />}
    </div>
  );
});

// Recursively walk React children and replace math placeholder strings with KaTeX components
function replaceMathPlaceholders(
  children: React.ReactNode,
  mathMap: Map<string, React.ReactNode>
): React.ReactNode {
  if (typeof children === "string") {
    // Check if entire string is a placeholder
    const node = mathMap.get(children);
    if (node) return node;
    // Check for inline placeholders within the string
    const parts = children.split(/(__MATH_\d+__)/g);
    if (parts.length === 1) return children;
    return parts.map((part) => {
      const node = mathMap.get(part);
      return node ?? part;
    });
  }
  if (Array.isArray(children)) {
    return children.map((child) => {
      if (typeof child === "string") {
        const node = mathMap.get(child);
        if (node) return node;
        const parts = child.split(/(__MATH_\d+__)/g);
        if (parts.length === 1) return child;
        return parts.map((part) => mathMap.get(part) ?? part);
      }
      return child;
    });
  }
  return children;
}

export function MessageBubble({ role, content, streaming }: Props & { role: string }) {
  if (role === "user") {
    return (
      <div className="flex justify-end nr-fade-up">
        <div className="max-w-[80%] bg-white text-black rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words select-text">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start nr-fade-up">
      <div className="max-w-[85%] bg-zinc-900 border border-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-zinc-100 select-text">
        <Markdown content={content} streaming={streaming} />
      </div>
    </div>
  );
}
