/**
 * Global Search Types
 * Unified search across all content types
 */

export type SearchResultType = 
  | "knowledge"
  | "guru"
  | "event"
  | "festival"
  | "gallery"
  | "faq"
  | "announcement";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  relevanceScore: number;
  matchedKeywords: string[];
  category?: string;
  date?: string;
}

export interface SearchSuggestion {
  text: string;
  type: "query" | "category" | "result";
  url?: string;
}

export interface SearchState {
  query: string;
  results: SearchResult[];
  suggestions: SearchSuggestion[];
  isLoading: boolean;
  selectedIndex: number;
  totalResults: number;
}

export interface SearchFilters {
  types?: SearchResultType[];
  categories?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export interface GlobalSearchConfig {
  placeholder: string;
  minQueryLength: number;
  maxResults: number;
  debounceMs: number;
  highlightEnabled: boolean;
  suggestionsEnabled: boolean;
}

export const DEFAULT_SEARCH_CONFIG: GlobalSearchConfig = {
  placeholder: "Search temple, events, articles...",
  minQueryLength: 2,
  maxResults: 10,
  debounceMs: 300,
  highlightEnabled: true,
  suggestionsEnabled: true,
};

export const SEARCH_TYPE_CONFIG: Record<SearchResultType, {
  icon: string;
  label: string;
  color: string;
}> = {
  knowledge: {
    icon: "📚",
    label: "Knowledge Articles",
    color: "text-blue-600",
  },
  guru: {
    icon: "👤",
    label: "Guru Parampara",
    color: "text-purple-600",
  },
  event: {
    icon: "📅",
    label: "Events",
    color: "text-green-600",
  },
  festival: {
    icon: "🎉",
    label: "Festivals",
    color: "text-orange-600",
  },
  gallery: {
    icon: "🖼️",
    label: "Gallery",
    color: "text-pink-600",
  },
  faq: {
    icon: "❓",
    label: "FAQs",
    color: "text-amber-600",
  },
  announcement: {
    icon: "📢",
    label: "Announcements",
    color: "text-red-600",
  },
};
