"use client";

import { useState } from "react";
import { SuggestedQuestion } from "@/types/ai";
import { SUGGESTED_QUESTIONS } from "@/lib/ai/systemPrompt";
import { ChevronDown, ChevronUp } from "lucide-react";

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

export function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Show only first 4 questions when collapsed
  const visibleQuestions = isExpanded ? SUGGESTED_QUESTIONS : SUGGESTED_QUESTIONS.slice(0, 4);

  return (
    <div className="px-3 py-1.5 border-t border-stone-100 bg-stone-50/50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-center gap-1 text-[10px] text-stone-400 hover:text-stone-600 transition-colors py-0.5"
      >
        <span>Try asking</span>
        {isExpanded ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>
      <div className="flex flex-wrap gap-1 justify-center">
        {visibleQuestions.map((q: SuggestedQuestion) => (
          <button
            key={q.id}
            onClick={() => onSelect(q.text)}
            className="px-2.5 py-1 
                     bg-white border border-stone-200 rounded-full
                     text-[11px] text-stone-500 hover:text-stone-700
                     hover:border-amber-300 hover:bg-amber-50
                     transition-all duration-200"
          >
            {q.text}
          </button>
        ))}
      </div>
    </div>
  );
}
