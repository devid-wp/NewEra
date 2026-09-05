import { memo } from "react";
import ReactMarkdown from "react-markdown";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

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
      className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors px-1.5 py-0.5 rounded"
      title="Copy code"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

type Props = {
  content: string;
  streaming?: boolean;
};

export const Markdown = memo(function Markdown({ content, streaming }: Props) {
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
});

export function MessageBubble({ role, content, streaming }: Props & { role: string }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-white text-black rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] bg-zinc-900 border border-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-zinc-100">
        <Markdown content={content} streaming={streaming} />
      </div>
    </div>
  );
}
