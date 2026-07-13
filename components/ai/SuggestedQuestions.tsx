"use client";

import { useState } from "react";
import { SuggestedQuestion } from "@/types/ai";
import { SUGGESTED_QUESTIONS } from "@/lib/ai/systemPrompt";
import { MessageSquare, ChevronDown, ChevronUp } from "lucide-react";

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

export function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Show only first 4 questions when collapsed
  const visibleQuestions = isExpanded ? SUGGESTED_QUESTIONS : SUGGESTED_QUESTIONS.slice(0, 4);

  return (
    <div className="px-3 py-2 border-t border-stone-200 bg-gradient-to-r from-amber-50/50 to-orange-50/30">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-xs text-stone-500 hover:text-stone-700 transition-colors py-1"
      >
        <span className="flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          Quick questions
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {visibleQuestions.map((q: SuggestedQuestion) => (
          <button
            key={q.id}
            onClick={() => onSelect(q.text)}
            className="inline-flex items-center gap-1 px-2 py-1 
                     bg-white/80 border border-stone-200 rounded-md
                     text-xs text-stone-600 hover:text-stone-800
                     hover:border-amber-300 hover:bg-amber-50
                     transition-all duration-200
                     focus:outline-none focus:ring-2 focus:ring-amber-300"
          >
            {q.icon && <span>{q.icon}</span>}
            <span>{q.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
