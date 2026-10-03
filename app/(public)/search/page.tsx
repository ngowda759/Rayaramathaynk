"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search,
  Calendar,
  BookOpen,
  Image,
  Quote,
  Music,
  FileText,
  MapPin,
  Clock,
  TrendingUp,
  Filter,
  Loader2,
} from "lucide-react";

interface SearchResult {
  id: string;
  type: string;
  title: string;
  description?: string;
  url: string;
  thumbnail?: string;
}

const SEARCH_TYPES = [
  { id: "all", label: "All Results", icon: Search },
  { id: "events", label: "Events", icon: Calendar },
  { id: "articles", label: "Articles", icon: BookOpen },
  { id: "quotes", label: "Quotes", icon: Quote },
  { id: "stotras", label: "Stotras", icon: Music },
  { id: "gallery", label: "Gallery", icon: Image },
  { id: "pages", label: "Pages", icon: FileText },
];

const POPULAR_SEARCHES = [
  "Aaradhane timings",
  "Daily Panchanga",
  "Raghavendra Stotra",
  "Festival schedule",
  "Seva booking",
  "Madhwa philosophy",
  "Guru parampara",
];

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [activeType, setActiveType] = useState("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [groupedResults, setGroupedResults] = useState<Record<string, SearchResult[]>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  async function performSearch(searchQuery: string) {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearched(true);
    setQuery(searchQuery);

    try {
      const typeParam = activeType === "all" ? "" : `&types=${activeType}`;
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}${typeParam}&grouped=true`);
      const data = await response.json();

      // Flatten results
      const flatResults: SearchResult[] = [];
      const grouped: Record<string, SearchResult[]> = {};

      if (data.grouped) {
        Object.entries(data.grouped).forEach(([type, items]: [string, any]) => {
          grouped[type] = items.map((item: any) => ({
            id: item.id || item.url,
            type: item.type || type,
            title: item.title,
            description: item.description,
            url: item.url,
            thumbnail: item.thumbnail || item.image,
          }));
          flatResults.push(...grouped[type]);
        });
      }

      setResults(flatResults);
      setGroupedResults(grouped);
      setTotalResults(data.totalResults || flatResults.length);

      // Update URL
      const url = new URL(window.location.href);
      url.searchParams.set("q", searchQuery);
      window.history.replaceState({}, "", url.toString());
    } catch (error) {
      console.error("[SearchPage] Search error:", error);
    } finally {
      setIsSearching(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    performSearch(query);
  }

  function handleTypeChange(type: string) {
    setActiveType(type);
    if (query) {
      performSearch(query);
    }
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case "events": return Calendar;
      case "articles": return BookOpen;
      case "quotes": return Quote;
      case "stotras": return Music;
      case "gallery": return Image;
      case "pages": return FileText;
      default: return Search;
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-amber-600 via-orange-600 to-red-600 py-12">
        <div className="mx-auto max-w-4xl px-6">
          <h1 className="text-center text-2xl font-bold text-white">Search</h1>
          <form onSubmit={handleSearch} className="mt-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search events, articles, quotes, stotras..."
                className="w-full rounded-xl border-0 bg-white py-4 pl-14 pr-4 text-lg shadow-lg focus:ring-2 focus:ring-amber-400"
                autoFocus
              />
            </div>
          </form>

          {/* Popular Searches */}
          <div className="mt-4">
            <p className="mb-2 text-sm text-amber-100">Popular searches:</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR_SEARCHES.map((search) => (
                <button
                  key={search}
                  onClick={() => performSearch(search)}
                  className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/30"
                >
                  <TrendingUp className="h-3 w-3" />
                  {search}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Type Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {SEARCH_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.id}
                onClick={() => handleTypeChange(type.id)}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  activeType === type.id
                    ? "bg-amber-100 text-amber-800 ring-2 ring-amber-500"
                    : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                {type.label}
              </button>
            );
          })}
        </div>

        {/* Loading State */}
        {isSearching && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
            <span className="ml-3 text-stone-600">Searching...</span>
          </div>
        )}

        {/* Results */}
        {!isSearching && searched && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-stone-600">
                Found <span className="font-semibold">{totalResults}</span> results for "{query}"
              </p>
            </div>

            {totalResults === 0 ? (
              <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
                <Search className="mx-auto h-12 w-12 text-stone-300" />
                <h2 className="mt-4 text-lg font-semibold text-stone-900">
                  No results found
                </h2>
                <p className="mt-2 text-stone-600">
                  Try different keywords or check spelling
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedResults).map(([type, items]) => {
                  const Icon = getTypeIcon(type);
                  const typeConfig = SEARCH_TYPES.find((t) => t.id === type);
                  
                  return (
                    <section key={type}>
                      <div className="mb-4 flex items-center gap-2">
                        <Icon className="h-5 w-5 text-amber-600" />
                        <h2 className="text-lg font-semibold text-stone-900">
                          {typeConfig?.label || type}
                        </h2>
                        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                          {items.length}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {items.map((result) => (
                          <a
                            key={result.id}
                            href={result.url}
                            className="group flex items-center gap-4 rounded-xl border border-stone-200 bg-white p-4 transition-all hover:border-amber-200 hover:shadow-md"
                          >
                            {result.thumbnail ? (
                              <img
                                src={result.thumbnail}
                                alt=""
                                className="h-16 w-16 shrink-0 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-stone-100">
                                <Icon className="h-6 w-6 text-stone-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-stone-900 group-hover:text-amber-700">
                                {result.title}
                              </h3>
                              {result.description && (
                                <p className="mt-1 line-clamp-2 text-sm text-stone-500">
                                  {result.description}
                                </p>
                              )}
                            </div>
                          </a>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Initial State - No Search */}
        {!searched && (
          <div className="text-center py-12">
            <Search className="mx-auto h-16 w-16 text-stone-300" />
            <h2 className="mt-4 text-lg font-semibold text-stone-900">
              Start searching
            </h2>
            <p className="mt-2 text-stone-600">
              Find events, articles, quotes, stotras, and more
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
