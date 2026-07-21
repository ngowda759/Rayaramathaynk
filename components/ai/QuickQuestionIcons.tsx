"use client";

import { useState } from "react";
import { useAIChat } from "./AIChatProvider";
import { Clock, Calendar, Heart, DollarSign, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickQuestion {
  id: string;
  icon: React.ReactNode;
  label: string;
  query: string;
}

const quickQuestions: QuickQuestion[] = [
  { 
    id: "timings", 
    icon: <Clock className="w-5 h-5" />, 
    label: "Temple Timings", 
    query: "What are the temple timings?" 
  },
  { 
    id: "events", 
    icon: <Calendar className="w-5 h-5" />, 
    label: "Upcoming Events", 
    query: "What events are coming up?" 
  },
  { 
    id: "sevas", 
    icon: <Heart className="w-5 h-5" />, 
    label: "Sevas Available", 
    query: "What sevas are available?" 
  },
  { 
    id: "donate", 
    icon: <DollarSign className="w-5 h-5" />, 
    label: "How to Donate", 
    query: "How can I donate to the temple?" 
  },
];

export function QuickQuestionIcons() {
  const { isOpen, sendMessage } = useAIChat();
  const [isHovered, setIsHovered] = useState(false);

  // Only show when chat is open
  if (!isOpen) return null;

  const handleQuestionClick = (query: string) => {
    sendMessage(query);
  };

  return (
    <div 
      className="fixed left-6 bottom-[calc(20rem+4rem)] z-50"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Expanded panel */}
      <div 
        className={cn(
          "bg-white rounded-xl shadow-xl border border-stone-200 overflow-hidden transition-all duration-300 ease-in-out",
          "w-10 hover:w-48",
          isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
        )}
        style={{ pointerEvents: isHovered ? "auto" : "none" }}
      >
        <div className="py-1">
          {quickQuestions.map((item) => (
            <button
              key={item.id}
              onClick={() => handleQuestionClick(item.query)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-left",
                "text-stone-600 hover:bg-amber-50 hover:text-amber-700",
                "transition-colors duration-200",
                "group"
              )}
              title={item.label}
            >
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-stone-100 group-hover:bg-amber-100 flex items-center justify-center transition-colors">
                {item.icon}
              </span>
              <span className={cn(
                "text-sm font-medium whitespace-nowrap",
                "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              )}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Collapsed indicator - visible when not hovering */}
      <div 
        className={cn(
          "absolute top-0 -left-3 w-3 h-full flex items-center transition-opacity duration-300",
          isHovered ? "opacity-0" : "opacity-100"
        )}
      >
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center shadow-md">
          <MessageCircle className="w-3 h-3 text-amber-600" />
        </div>
      </div>
    </div>
  );
}
