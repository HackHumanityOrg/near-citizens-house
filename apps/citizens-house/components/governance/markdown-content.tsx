"use client"

import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface Props {
  children: string
}

export function MarkdownContent({ children }: Props) {
  return (
    <div
      className={[
        // Base prose
        "prose prose-sm dark:prose-invert prose-slate max-w-none break-words",
        // Headings
        "prose-headings:font-fk-grotesk",
        // Links
        "prose-a:text-[#2563eb] dark:prose-a:text-[#60a5fa] prose-a:underline prose-a:underline-offset-2",
        // Inline code
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-code:rounded prose-code:bg-[#f1f5f9] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[#334155] prose-code:font-normal prose-code:text-[13px]",
        "dark:prose-code:bg-white/10 dark:prose-code:text-[#e2e8f0]",
        // Code blocks
        "prose-pre:bg-[#1e293b] prose-pre:text-[#e2e8f0] prose-pre:rounded-lg",
        "dark:prose-pre:bg-[#0f172a] dark:prose-pre:text-[#e2e8f0]",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit",
        // Blockquotes
        "prose-blockquote:border-[#cbd5e1] dark:prose-blockquote:border-[#475569]",
        // Tables
        "prose-th:text-left",
        // Images
        "prose-img:rounded-lg",
        // HR
        "prose-hr:border-[#e2e8f0] dark:prose-hr:border-white/10",
      ].join(" ")}
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ node: _node, ...props }) => <a target="_blank" rel="noopener noreferrer" {...props} />,
        }}
      >
        {children}
      </Markdown>
    </div>
  )
}
