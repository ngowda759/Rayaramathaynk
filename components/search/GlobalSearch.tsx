"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, ArrowRight, Clock, Command } from "lucide-react";
import Link from "next/link";
import {
  SearchResult,
  SearchSuggestion,
  SEARCH_TYPE_CONFIG,
  SearchState,
} from "@/types/search";
import { highlightKeywords } from "@/services/search.service";

interface GlobalSearchProps {
  placeholder?: string;
  className?: string;
}

const initialState: SearchState = {
  query: "",
  results: [],
  suggestions: [],
  isLoading: false,
  selectedIndex: -1,
  totalResults: 0,
};

export default function GlobalSearch({
  placeholder = "Search temple, events, articles...",
  className = "",
}: GlobalSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<SearchState>(initialState);
  const [isOpen, setIsOpen] = useState(false);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (event.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Search with debounce
  const performSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setState((prev) => ({
        ...prev,
        query,
        results: [],
        suggestions: [],
        isLoading: false,
        totalResults: 0,
      }));
      return;
    }

    setState((prev) => ({ ...prev, query, isLoading: true }));

    try {
      const [resultsResponse, suggestionsResponse] = await Promise.all([
        fetch(`/api/search?q=${encodeURIComponent(query)}&grouped=true`),
        fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`),
      ]);

      const resultsData = await resultsResponse.json();
      const suggestionsData = await suggestionsResponse.json();

      setState((prev) => ({
        ...prev,
        results: resultsData.results || [],
        suggestions: suggestionsData || [],
        isLoading: false,
        totalResults: resultsData.totalResults || 0,
        selectedIndex: -1,
      }));
    } catch {
      setState((prev) => ({ ...prev, isLoading: false, results: [] }));
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(state.query);
    }, 300);

    return () => clearTimeout(timer);
  }, [state.query, performSearch]);

  // Keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    const totalItems = state.results.length + state.suggestions.length;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setState((prev) => ({
          ...prev,
          selectedIndex: Math.min(prev.selectedIndex + 1, totalItems - 1),
        }));
        break;
      case "ArrowUp":
        event.preventDefault();
        setState((prev) => ({
          ...prev,
          selectedIndex: Math.max(prev.selectedIndex - 1, -1),
        }));
        break;
      case "Enter":
        event.preventDefault();
        if (state.selectedIndex >= 0) {
          const suggestionsCount = state.suggestions.length;
          if (state.selectedIndex < suggestionsCount) {
            const suggestion = state.suggestions[state.selectedIndex];
            if (suggestion.url) {
              router.push(suggestion.url);
            } else {
              setState((prev) => ({ ...prev, query: suggestion.text }));
            }
          } else {
            const result =
              state.results[state.selectedIndex - suggestionsCount];
            router.push(result.url);
          }
        } else if (state.results.length > 0) {
          router.push(state.results[0].url);
        }
        break;
    }
  };

  const handleResultClick = (result: SearchResult) => {
    router.push(result.url);
    setIsOpen(false);
    setState(initialState);
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    if (suggestion.url) {
      router.push(suggestion.url);
      setIsOpen(false);
    } else {
      setState((prev) => ({ ...prev, query: suggestion.text }));
    }
  };

  const clearSearch = () => {
    setState(initialState);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
        <input
          ref={inputRef}
          type="text"
          value={state.query}
          onChange={(e) => setState((prev) => ({ ...prev, query: e.target.value }))}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-10 pr-16 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {state.isLoading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          ) : (
            <>
              {state.query && (
                <button
                  onClick={clearSearch}
                  className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <kbd className="hidden items-center gap-1 rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-xs text-stone-500 sm:flex">
                <Command className="h-3 w-3" />K
              </kbd>
            </>
          )}
        </div>
      </div>

      {/* Search Results Dropdown */}
      <AnimatePresence>
        {isOpen && (state.query || state.suggestions.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl"
          >
            {/* Suggestions */}
            {state.suggestions.length > 0 && !state.query && (
              <div className="border-b border-stone-100 p-2">
                <p className="px-3 py-1 text-xs font-medium text-stone-500">
                  Quick Links
                </p>
                {state.suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-stone-700 hover:bg-amber-50"
                  >
                    {suggestion.type === "category" ? (
                      <ArrowRight className="h-4 w-4 text-stone-400" />
                    ) : (
                      <Clock className="h-4 w-4 text-stone-400" />
                    )}
                    <span>{suggestion.text}</span>
                    {suggestion.type === "category" && (
                      <span className="ml-auto text-xs text-stone-400">
                        Browse
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Results */}
            {state.results.length > 0 && (
              <div className="max-h-[400px] overflow-y-auto p-2">
                {state.results.map((result, index) => {
                  const globalIndex = state.suggestions.length + index;
                  const isSelected = state.selectedIndex === globalIndex;
                  const typeConfig = SEARCH_TYPE_CONFIG[result.type];

                  return (
                    <button
                      key={result.id}
                      onClick={() => handleResultClick(result)}
                      className={`flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors ${
                        isSelected
                          ? "bg-amber-50 ring-2 ring-amber-200"
                          : "hover:bg-stone-50"
                      }`}
                    >
                      <span className="mt-0.5 text-xl">{typeConfig.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-medium text-stone-900 truncate"
                          dangerouslySetInnerHTML={{
                            __html: highlightKeywords(result.title, []),
                          }}
                        />
                        <p className="mt-1 line-clamp-2 text-sm text-stone-500">
                          {result.description}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <span
                            className={`text-xs font-medium ${typeConfig.color}`}
                          >
                            {typeConfig.label}
                          </span>
                          {result.category && (
                            <>
                              <span className="text-stone-300">•</span>
                              <span className="text-xs text-stone-400">
                                {result.category}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 flex-shrink-0 text-stone-300" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Empty State */}
            {state.query.length >= 2 &&
              !state.isLoading &&
              state.results.length === 0 && (
                <div className="p-8 text-center">
                  <Search className="mx-auto h-10 w-10 text-stone-300" />
                  <p className="mt-2 text-sm font-medium text-stone-900">
                    No results found
                  </p>
                  <p className="mt-1 text-sm text-stone-500">
                    Try different keywords or browse categories
                  </p>
                </div>
              )}

            {/* Footer */}
            {state.totalResults > 0 && (
              <div className="flex items-center justify-between border-t border-stone-100 p-3 text-xs text-stone-500">
                <span>
                  {state.totalResults} result{state.totalResults !== 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-stone-200 bg-stone-50 px-1.5">
                      ↑↓
                    </kbd>
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-stone-200 bg-stone-50 px-1.5">
                      ↵
                    </kbd>
                    Select
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
