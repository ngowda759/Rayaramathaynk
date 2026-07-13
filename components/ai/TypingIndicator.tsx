"use client";

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3" role="status" aria-label="Typing">
      <span className="text-sm text-stone-500 mr-2">Raya is typing</span>
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}
