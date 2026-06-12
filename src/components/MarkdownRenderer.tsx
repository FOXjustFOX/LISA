import React from "react";

interface MarkdownRendererProps {
  text: string;
}

export function MarkdownRenderer({ text }: MarkdownRendererProps) {
  if (!text) return null;

  // Split content by backtick blocks (``` ... ```)
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-3 leading-relaxed text-slate-850 break-words text-sm md:text-md">
      {parts.map((part, index) => {
        if (part.startsWith("```")) {
          // Identify block lines
          const lines = part.split("\n");
          let language = "code";
          if (lines[0].length > 3) {
            language = lines[0].slice(3).trim();
          }
          const codeContent = lines.slice(1, -1).join("\n");

          return (
            <div
              key={index}
              className="my-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs md:text-sm"
            >
              <div className="flex items-center justify-between bg-slate-100 px-4 py-2 text-slate-600 font-semibold select-none border-b border-slate-200">
                <span className="text-[11px] uppercase tracking-wider">{language}</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(codeContent)}
                  className="rounded bg-white border border-slate-250 px-2 py-0.5 text-[10px] font-bold text-slate-700 uppercase hover:bg-slate-200 active:scale-95 transition-all cursor-pointer"
                >
                  Copy
                </button>
              </div>
              <pre className="overflow-x-auto p-4 leading-relaxed text-slate-850">
                <code>{codeContent}</code>
              </pre>
            </div>
          );
        }

        // Outer paragraphs, header logic, lists, inline codes
        const contentLines = part.split("\n");
        return (
          <div key={index} className="space-y-1.5">
            {contentLines.map((line, lineIndex) => {
              const trimmed = line.trim();

              // Empty line rendering (margin spacer)
              if (!trimmed) {
                return <div key={lineIndex} className="h-2" />;
              }

              // Headers
              if (trimmed.startsWith("### ")) {
                return (
                  <h4 key={lineIndex} className="text-base font-bold text-slate-900 mt-3 pt-1">
                    {parseInlineToNodes(trimmed.slice(4))}
                  </h4>
                );
              }
              if (trimmed.startsWith("## ")) {
                return (
                  <h3 key={lineIndex} className="text-lg font-extrabold text-slate-950 mt-4 border-b border-slate-100 pb-1">
                    {parseInlineToNodes(trimmed.slice(3))}
                  </h3>
                );
              }
              if (trimmed.startsWith("# ")) {
                return (
                  <h2 key={lineIndex} className="text-xl font-black text-slate-950 mt-5 mb-1">
                    {parseInlineToNodes(trimmed.slice(2))}
                  </h2>
                );
              }

              // Unordered lists
              if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                return (
                  <ul key={lineIndex} className="list-disc pl-5 mt-1 space-y-0.5">
                    <li className="text-slate-800">
                      {parseInlineToNodes(trimmed.slice(2))}
                    </li>
                  </ul>
                );
              }

              // Ordered list match (e.g., "1. List item")
              const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
              if (numberedMatch) {
                return (
                  <ol key={lineIndex} className="list-decimal pl-5 mt-1 space-y-0.5">
                    <li className="text-slate-800">
                      {parseInlineToNodes(numberedMatch[2])}
                    </li>
                  </ol>
                );
              }

              // Blockquotes
              if (trimmed.startsWith("> ")) {
                return (
                  <blockquote key={lineIndex} className="border-l-4 border-amber-500 bg-amber-50/50 pl-4 py-1 pr-2 my-2 text-slate-700 italic rounded-r">
                    {parseInlineToNodes(trimmed.slice(2))}
                  </blockquote>
                );
              }

              // Standard text paragraph
              return (
                <p key={lineIndex} className="text-slate-800 leading-relaxed">
                  {parseInlineToNodes(line)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// Sub-router process inline tokens: bold (**), italic (*), code (`)
function parseInlineToNodes(lineText: string): React.ReactNode[] {
  const parts = lineText.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-extrabold text-slate-950">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded bg-slate-100 text-rose-700 font-mono text-[12px] px-1.5 py-0.5 border border-slate-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={index} className="italic text-slate-700 font-medium">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}
