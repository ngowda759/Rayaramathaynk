"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Clock,
  TrendingUp,
  Calendar,
  BookOpen,
  Image,
  Quote,
  Music,
  Video,
  MapPin,
  FileText,
  ChevronRight,
  Loader2,
} from "lucide-react";

interface SearchResult {
  id: string;
  type: "event" | "article" | "quote" | "gallery" | "stotra" | "page" | "faq";
  title: string;
  description?: string;
  url: string;
  thumbnail?: string;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

// Popular search queries
const POPULAR_SEARCHES = [
  "Aaradhane timings",
  "Daily Panchanga",
  "Raghavendra Stotra",
  "Festival schedule",
  "Seva booking",
];

// Recent searches (stored in localStorage)
const getRecentSearches = (): string[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem("recentSearches");
  return stored ? JSON.parse(stored) : [];
};

const addRecentSearch = (query: string) => {
  if (typeof window === "undefined") return;
  const recent = getRecentSearches();
  const filtered = recent.filter((s) => s !== query);
  const updated = [query, ...filtered].slice(0, 5);
  localStorage.setItem("recentSearches", JSON.stringify(updated));
};

// Search suggestions by type
const SEARCH_TYPES = [
  { id: "all", label: "All", icon: Search },
  { id: "events", label: "Events", icon: Calendar },
  { id: "articles", label: "Articles", icon: BookOpen },
  { id: "quotes", label: "Quotes", icon: Quote },
  { id: "stotras", label: "Stotras", icon: Music },
  { id: "gallery", label: "Gallery", icon: Image },
  { id: "pages", label: "Pages", icon: FileText },
];

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeType, setActiveType] = useState("all");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Load recent searches
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- State initialization
    setRecentSearches(getRecentSearches());
  }, [isOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (!isOpen) {
          router.push("/search");
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, router, onClose]);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const typeParam = activeType === "all" ? "" : `&types=${activeType}`;
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}${typeParam}&grouped=true`);
      const data = await response.json();
      
      // Flatten grouped results for display
      const flatResults: SearchResult[] = [];
      if (data.grouped) {
        Object.entries(data.grouped).forEach(([type, items]: [string, any]) => {
          items.forEach((item: any) => {
            flatResults.push({
              id: item.id || item.url,
              type: item.type || type,
              title: item.title,
              description: item.description,
              url: item.url,
              thumbnail: item.thumbnail || item.image,
            });
          });
        });
      }
      setResults(flatResults);
    } catch (error) {
      console.error("[GlobalSearch] Search error:", error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [activeType]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      performSearch(query);
    }, 300);
    return () => clearTimeout(debounce);
  }, [query, performSearch]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = results.length + (query ? 0 : recentSearches.length);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) {
        handleSelectResult(results[selectedIndex]);
      } else if (selectedIndex >= results.length && recentSearches[selectedIndex - results.length]) {
        setQuery(recentSearches[selectedIndex - results.length]);
      }
    }
  };

  function handleSelectResult(result: SearchResult) {
    addRecentSearch(result.title);
    router.push(result.url);
    onClose();
  }

  function handleRecentClick(search: string) {
    setQuery(search);
  }

  function clearRecentSearches() {
    localStorage.removeItem("recentSearches");
    setRecentSearches([]);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative mx-auto mt-[10vh] max-w-2xl px-4">
        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
          {/* Search Input */}
          <div className="flex items-center gap-3 border-b border-stone-200 p-4">
            <Search className="h-5 w-5 shrink-0 text-stone-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search events, articles, quotes, stotras..."
              className="flex-1 bg-transparent text-lg text-stone-900 placeholder-stone-400 outline-none"
            />
            {isSearching && <Loader2 className="h-5 w-5 animate-spin text-stone-400" />}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Type Filters */}
          <div className="flex gap-2 border-b border-stone-100 px-4 py-2 overflow-x-auto">
            {SEARCH_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => setActiveType(type.id)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                    activeType === type.id
                      ? "bg-amber-100 text-amber-800"
                      : "text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {type.label}
                </button>
              );
            })}
          </div>

          {/* Results / Recent / Popular */}
          <div className="max-h-[60vh] overflow-y-auto p-4">
            {/* No query - show recent and popular */}
            {!query && (
              <>
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <div className="mb-6">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-stone-600">Recent Searches</h3>
                      <button
                        onClick={clearRecentSearches}
                        className="text-xs text-stone-500 hover:text-stone-700"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="space-y-1">
                      {recentSearches.map((search, index) => (
                        <button
                          key={search}
                          onClick={() => handleRecentClick(search)}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                            selectedIndex === index
                              ? "bg-amber-50 text-amber-800"
                              : "text-stone-600 hover:bg-stone-50"
                          }`}
                        >
                          <Clock className="h-4 w-4 text-stone-400" />
                          {search}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Popular Searches */}
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-stone-600">Popular Searches</h3>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR_SEARCHES.map((search) => (
                      <button
                        key={search}
                        onClick={() => setQuery(search)}
                        className="flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-sm text-stone-600 hover:bg-amber-50 hover:text-amber-700"
                      >
                        <TrendingUp className="h-3 w-3" />
                        {search}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Search Results */}
            {query && results.length > 0 && (
              <div className="space-y-1">
                {results.map((result, index) => (
                  <button
                    key={result.id}
                    onClick={() => handleSelectResult(result)}
                    className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                      selectedIndex === index
                        ? "bg-amber-50"
                        : "hover:bg-stone-50"
                    }`}
                  >
                    {result.thumbnail ? (
                      <img
                        src={result.thumbnail}
                        alt=""
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-stone-100">
                        {result.type === "event" && <Calendar className="h-5 w-5 text-blue-600" />}
                        {result.type === "article" && <BookOpen className="h-5 w-5 text-green-600" />}
                        {result.type === "quote" && <Quote className="h-5 w-5 text-purple-600" />}
                        {result.type === "stotra" && <Music className="h-5 w-5 text-amber-600" />}
                        {result.type === "gallery" && <Image className="h-5 w-5 text-pink-600" />}
                        {result.type === "faq" && <FileText className="h-5 w-5 text-stone-600" />}
                        {result.type === "page" && <MapPin className="h-5 w-5 text-orange-600" />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-stone-900">{result.title}</p>
                      {result.description && (
                        <p className="truncate text-sm text-stone-500">{result.description}</p>
                      )}
                    </div>
                    <span className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                      {result.type}
                    </span>
                    <ChevronRight className="h-4 w-4 text-stone-400" />
                  </button>
                ))}
              </div>
            )}

            {/* No Results */}
            {query && results.length === 0 && !isSearching && (
              <div className="py-8 text-center">
                <Search className="mx-auto h-12 w-12 text-stone-300" />
                <p className="mt-4 text-stone-600">No results found for "{query}"</p>
                <p className="text-sm text-stone-500">Try different keywords or check spelling</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-4 py-2 text-xs text-stone-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-white px-1.5 py-0.5 font-mono shadow-sm">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-white px-1.5 py-0.5 font-mono shadow-sm">↵</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-white px-1.5 py-0.5 font-mono shadow-sm">esc</kbd>
                Close
              </span>
            </div>
            <span>Press Ctrl+K to open search</span>
          </div>
        </div>
      </div>
    </div>
  );
}
