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
                            className="my-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs md:text-sm">
                            <div className="flex items-center justify-between bg-slate-100 px-4 py-2 text-slate-600 font-semibold select-none border-b border-slate-200">
                                <span className="text-[11px] uppercase tracking-wider">
                                    {language}
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        navigator.clipboard.writeText(
                                            codeContent,
                                        )
                                    }
                                    className="rounded bg-white border border-slate-250 px-2 py-0.5 text-[10px] font-bold text-slate-700 uppercase hover:bg-slate-200 active:scale-95 transition-all cursor-pointer">
                                    Copy
                                </button>
                            </div>
                            <pre className="overflow-x-auto p-4 leading-relaxed text-slate-850">
                                <code>{codeContent}</code>
                            </pre>
                        </div>
                    );
                }

                // Outer paragraphs, header logic, lists, inline codes, tables
                const contentLines = part.split("\n");
                const contentNodes: React.ReactNode[] = [];

                for (
                    let lineIndex = 0;
                    lineIndex < contentLines.length;
                    lineIndex += 1
                ) {
                    const line = contentLines[lineIndex];
                    const trimmed = line.trim();

                    // Empty line rendering (margin spacer)
                    if (!trimmed) {
                        contentNodes.push(
                            <div
                                key={`${index}-${lineIndex}`}
                                className="h-2"
                            />,
                        );
                        continue;
                    }

                    const nextLine = contentLines[lineIndex + 1]?.trim();
                    const isTableHeader =
                        trimmed.includes("|") &&
                        nextLine !== undefined &&
                        /^\s*\|?\s*[:\-]+(?:\s*\|\s*[:\-]+)+\s*\|?\s*$/.test(
                            nextLine,
                        );

                    if (isTableHeader) {
                        const tableLines = [trimmed];
                        let tableLine = lineIndex + 1;

                        while (
                            tableLine + 1 < contentLines.length &&
                            contentLines[tableLine + 1].trim().includes("|")
                        ) {
                            tableLines.push(contentLines[tableLine + 1].trim());
                            tableLine += 1;
                        }

                        const parseRow = (rowText: string) =>
                            rowText
                                .replace(/^\s*\||\|\s*$/g, "")
                                .split("|")
                                .map((cell) => cell.trim());

                        const headerCells = parseRow(tableLines[0]);
                        const bodyRows = tableLines.slice(2).map(parseRow);
                        const tableKey = `${index}-table-${lineIndex}`;

                        contentNodes.push(
                            <div
                                key={tableKey}
                                className="my-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                <table className="min-w-full border-collapse text-sm">
                                    <thead className="bg-slate-100 text-slate-900">
                                        <tr>
                                            {headerCells.map(
                                                (cell, cellIndex) => (
                                                    <th
                                                        key={cellIndex}
                                                        className="border border-slate-200 px-3 py-2 text-left font-semibold">
                                                        {parseInlineToNodes(
                                                            cell,
                                                        )}
                                                    </th>
                                                ),
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bodyRows.map((row, rowIndex) => (
                                            <tr
                                                key={rowIndex}
                                                className={
                                                    rowIndex % 2 === 0
                                                        ? "bg-white"
                                                        : "bg-slate-50"
                                                }>
                                                {row.map((cell, cellIndex) => (
                                                    <td
                                                        key={cellIndex}
                                                        className="border border-slate-200 px-3 py-2 align-top">
                                                        {parseInlineToNodes(
                                                            cell,
                                                        )}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>,
                        );

                        lineIndex = tableLine;
                        continue;
                    }

                    // Headers
                    if (trimmed.startsWith("### ")) {
                        contentNodes.push(
                            <h4
                                key={`${index}-${lineIndex}`}
                                className="text-base font-bold text-slate-900 mt-3 pt-1">
                                {parseInlineToNodes(trimmed.slice(4))}
                            </h4>,
                        );
                        continue;
                    }
                    if (trimmed.startsWith("## ")) {
                        contentNodes.push(
                            <h3
                                key={`${index}-${lineIndex}`}
                                className="text-lg font-extrabold text-slate-950 mt-4 border-b border-slate-100 pb-1">
                                {parseInlineToNodes(trimmed.slice(3))}
                            </h3>,
                        );
                        continue;
                    }
                    if (trimmed.startsWith("# ")) {
                        contentNodes.push(
                            <h2
                                key={`${index}-${lineIndex}`}
                                className="text-xl font-black text-slate-950 mt-5 mb-1">
                                {parseInlineToNodes(trimmed.slice(2))}
                            </h2>,
                        );
                        continue;
                    }

                    // Unordered lists
                    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                        contentNodes.push(
                            <ul
                                key={`${index}-${lineIndex}`}
                                className="list-disc pl-5 mt-1 space-y-0.5">
                                <li className="text-slate-800">
                                    {parseInlineToNodes(trimmed.slice(2))}
                                </li>
                            </ul>,
                        );
                        continue;
                    }

                    // Ordered list match (e.g., "1. List item")
                    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
                    if (numberedMatch) {
                        contentNodes.push(
                            <ol
                                key={`${index}-${lineIndex}`}
                                className="list-decimal pl-5 mt-1 space-y-0.5">
                                <li className="text-slate-800">
                                    {parseInlineToNodes(numberedMatch[2])}
                                </li>
                            </ol>,
                        );
                        continue;
                    }

                    // Blockquotes
                    if (trimmed.startsWith("> ")) {
                        contentNodes.push(
                            <blockquote
                                key={`${index}-${lineIndex}`}
                                className="border-l-4 border-amber-500 bg-amber-50/50 pl-4 py-1 pr-2 my-2 text-slate-700 italic rounded-r">
                                {parseInlineToNodes(trimmed.slice(2))}
                            </blockquote>,
                        );
                        continue;
                    }

                    // Standard text paragraph
                    contentNodes.push(
                        <p
                            key={`${index}-${lineIndex}`}
                            className="text-slate-800 leading-relaxed">
                            {parseInlineToNodes(line)}
                        </p>,
                    );
                }

                return (
                    <div key={index} className="space-y-1.5">
                        {contentNodes}
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
                    className="rounded bg-slate-100 text-rose-700 font-mono text-[12px] px-1.5 py-0.5 border border-slate-200">
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
