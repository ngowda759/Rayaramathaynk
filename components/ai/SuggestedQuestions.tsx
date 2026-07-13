"use client";

import { SuggestedQuestion } from "@/types/ai";
import { SUGGESTED_QUESTIONS } from "@/lib/ai/systemPrompt";

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

export function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  return (
    <div className="p-4 border-t border-stone-200 bg-stone-50">
      <p className="text-xs text-stone-500 mb-3 text-center">Quick questions</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {SUGGESTED_QUESTIONS.map((q: SuggestedQuestion) => (
          <button
            key={q.id}
            onClick={() => onSelect(q.text)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 
                     bg-white border border-stone-200 rounded-full
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
