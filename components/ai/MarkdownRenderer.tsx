"use client";

import { useMemo } from "react";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const renderedContent = useMemo(() => {
    if (!content) return "";

    // 1. Escape ALL HTML fully using structural string split/join to prevent regex bypasses.
    let html = content
      .split('&').join('&amp;')
      .split('<').join('&lt;')
      .split('>').join('&gt;')
      .split('"').join('&quot;')
      .split("'").join('&#039;');

    // 2. Safe URL handler
    const safeUrl = (url: string) => {
        // Only allow safe protocols
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:') || url.startsWith('tel:')) {
            return url;
        }
        return '#';
    };

    // 3. Process links first so their internal tokens aren't broken by other formatting
    // Pattern: [text](url) -> safe replace
    // We'll use a safe loop to find markdown links since Regex might be vulnerable to ReDoS if not careful.
    // Or we can use a strict, safe regex that only matches exact structures without backtracking.
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, (match, text, url) => {
        return `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer" class="text-amber-600 hover:text-amber-700 underline">${text}</a>`;
    });

    // 4. Bold
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    
    // 5. Italic
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    
    // 6. Headers
    html = html.replace(/^### (.*$)/gim, "<h4 class=\"text-base font-semibold mt-3 mb-1\">$1</h4>");
    html = html.replace(/^## (.*$)/gim, "<h3 class=\"text-lg font-semibold mt-3 mb-1\">$1</h3>");
    html = html.replace(/^# (.*$)/gim, "<h2 class=\"text-xl font-semibold mt-4 mb-2\">$1</h2>");

    // 7. Lists
    html = html.replace(/^\- (.*$)/gim, "<li class=\"ml-4\">$1</li>");
    html = html.replace(/^(\d+)\. (.*$)/gim, "<li class=\"ml-4 list-decimal\">$2</li>");
    
    // 8. Line breaks
    html = html.replace(/\n\n/g, "</p><p class=\"mb-2\">");
    html = html.replace(/\n/g, "<br/>");

    // 9. Wrap in paragraph
    html = `<p class="mb-2">${html}</p>`;
    
    // 10. Clean up empty paragraphs
    html = html.replace(/<p class="mb-2"><\/p>/g, "");

    // 11. Inline code
    html = html.replace(/`(.*?)`/g, "<code class=\"bg-stone-100 px-1 py-0.5 rounded text-sm font-mono\">$1</code>");

    return html;
  }, [content]);

  return (
    <div 
      className="text-sm leading-relaxed"
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  );
}
