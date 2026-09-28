import React, { useMemo } from "react";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const renderedContent = useMemo(() => {
    if (!content) return [];

    // Safe structure replacement
    let safeContent = content
      .split('&').join('&amp;')
      .split('<').join('&lt;')
      .split('>').join('&gt;');

    const lines = safeContent.split('\n');

    return lines.map((line, lineIndex) => {
      if (!line.trim()) return <br key={`br-${lineIndex}`} />;

      let elements: React.ReactNode[] = [];

      // Parse links, bold, italic
      const tokenRegex = /(\[(.*?)\]\((https?:\/\/[^\s"']+|mailto:[^\s"']+|tel:[^\s"']+)\))|(\*\*(.*?)\*\*)|(_(.*?)_)|(`(.*?)`)/g;

      let match;
      let lastIndex = 0;
      let elementKey = 0;

      while ((match = tokenRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          elements.push(<span key={elementKey++}>{line.substring(lastIndex, match.index)}</span>);
        }

        if (match[1]) {
          // Link: match[2] is text, match[3] is url
          elements.push(
            <a key={elementKey++} href={match[3]} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-700 underline">
              {match[2]}
            </a>
          );
        } else if (match[4]) {
          // Bold: match[5] is text
          elements.push(<strong key={elementKey++}>{match[5]}</strong>);
        } else if (match[6]) {
          // Italic: match[7] is text
          elements.push(<em key={elementKey++}>{match[7]}</em>);
        } else if (match[8]) {
          // Code: match[9] is text
          elements.push(<code key={elementKey++} className="bg-stone-100 px-1 py-0.5 rounded text-sm font-mono">{match[9]}</code>);
        }

        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < line.length) {
        elements.push(<span key={elementKey++}>{line.substring(lastIndex)}</span>);
      }

      if (line.startsWith('### ')) {
         return <h4 key={lineIndex} className="text-base font-semibold mt-3 mb-1">{elements.slice(1)}</h4>;
      } else if (line.startsWith('## ')) {
         return <h3 key={lineIndex} className="text-lg font-semibold mt-3 mb-1">{elements.slice(1)}</h3>;
      } else if (line.startsWith('# ')) {
         return <h2 key={lineIndex} className="text-xl font-semibold mt-4 mb-2">{elements.slice(1)}</h2>;
      } else if (line.startsWith('- ')) {
         return <li key={lineIndex} className="ml-4">{elements.slice(1)}</li>;
      } else if (/^\d+\.\s/.test(line)) {
         return <li key={lineIndex} className="ml-4 list-decimal">{elements}</li>;
      }

      return <p key={lineIndex} className="mb-2">{elements}</p>;
    });
  }, [content]);

  return (
    <div className="text-sm leading-relaxed">
      {renderedContent}
    </div>
  );
}
