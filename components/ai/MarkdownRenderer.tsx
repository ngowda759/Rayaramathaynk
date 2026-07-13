"use client";

import { useMemo } from "react";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const renderedContent = useMemo(() => {
    // Simple markdown-like rendering
    let html = content;

    // Escape HTML
    html = html.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    
    // Italic
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    
    // Headers
    html = html.replace(/^### (.*$)/gim, "<h4 class=\"text-base font-semibold mt-3 mb-1\">$1</h4>");
    html = html.replace(/^## (.*$)/gim, "<h3 class=\"text-lg font-semibold mt-3 mb-1\">$1</h3>");
    html = html.replace(/^# (.*$)/gim, "<h2 class=\"text-xl font-semibold mt-4 mb-2\">$1</h2>");

    // Lists
    html = html.replace(/^\- (.*$)/gim, "<li class=\"ml-4\">$1</li>");
    html = html.replace(/^(\d+)\. (.*$)/gim, "<li class=\"ml-4 list-decimal\">$2</li>");
    
    // Line breaks
    html = html.replace(/\n\n/g, "</p><p class=\"mb-2\">");
    html = html.replace(/\n/g, "<br/>");

    // Wrap in paragraph
    html = `<p class=\"mb-2\">${html}</p>`;
    
    // Clean up empty paragraphs
    html = html.replace(/<p class="mb-2"><\/p>/g, "");

    // Inline code
    html = html.replace(/`(.*?)`/g, "<code class=\"bg-stone-100 px-1 py-0.5 rounded text-sm font-mono\">$1</code>");

    // Links
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-amber-600 hover:text-amber-700 underline">$1</a>');

    return html;
  }, [content]);

  return (
    <div 
      className="text-sm leading-relaxed"
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  );
}
