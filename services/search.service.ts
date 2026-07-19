/**
 * Global Search Service
 * Unified search across all content types
 */

import {
  SearchResult,
  SearchResultType,
  SearchFilters,
  SearchSuggestion,
  SEARCH_TYPE_CONFIG,
} from "@/types/search";
import { knowledgeService } from "./knowledge.service";
import { eventService } from "./event.service";
import { galleryService } from "./gallery.service";
import { TempleEvent } from "@/types/event";
import { GalleryMedia } from "@/types/gallery";

/**
 * Search across all content types
 */
export async function searchAll(
  query: string,
  filters?: SearchFilters,
  maxResultsPerType = 3
): Promise<SearchResult[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const results: SearchResult[] = [];

  // Search knowledge articles
  if (!filters?.types || filters.types.includes("knowledge")) {
    const knowledgeResults = await searchKnowledge(query, maxResultsPerType);
    results.push(...knowledgeResults);
  }

  // Search events
  if (!filters?.types || filters.types.includes("event")) {
    const eventResults = await searchEvents(query, maxResultsPerType);
    results.push(...eventResults);
  }

  // Search festivals (events with festival category)
  if (!filters?.types || filters.types.includes("festival")) {
    const festivalResults = await searchFestivals(query, maxResultsPerType);
    results.push(...festivalResults);
  }

  // Search gallery
  if (!filters?.types || filters.types.includes("gallery")) {
    const galleryResults = await searchGallery(query, maxResultsPerType);
    results.push(...galleryResults);
  }

  // Search FAQs from knowledge
  if (!filters?.types || filters.types.includes("faq")) {
    const faqResults = await searchFAQs(query, maxResultsPerType);
    results.push(...faqResults);
  }

  // Sort by relevance score
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Apply category filters
  if (filters?.categories && filters.categories.length > 0) {
    return results.filter((r) =>
      filters.categories!.some((cat) => r.category?.includes(cat))
    );
  }

  return results.slice(0, 20);
}

/**
 * Search knowledge articles
 */
async function searchKnowledge(
  query: string,
  maxResults: number
): Promise<SearchResult[]> {
  try {
    const results = await knowledgeService.searchKnowledge(query, maxResults);

    return results.map((result) => ({
      id: result.article.id,
      type: "knowledge" as SearchResultType,
      title: result.article.title,
      description: result.article.content.slice(0, 150) + "...",
      url: `/knowledge/article/${result.article.slug}`,
      relevanceScore: result.relevanceScore,
      matchedKeywords: result.matchedKeywords,
      category: result.article.category,
    }));
  } catch {
    return [];
  }
}

/**
 * Search events
 */
async function searchEvents(
  query: string,
  maxResults: number
): Promise<SearchResult[]> {
  try {
    const events = await eventService.getEvents();
    const normalizedQuery = query.toLowerCase();

    const scored: Array<{ event: TempleEvent; score: number }> = events
      .filter((event) => {
        const title = event.title.toLowerCase();
        const description = (event.description || "").toLowerCase();
        return (
          title.includes(normalizedQuery) || description.includes(normalizedQuery)
        );
      })
      .map((event) => {
        let score = 0;
        if (event.title.toLowerCase().includes(normalizedQuery)) score += 20;
        if ((event.description || "").toLowerCase().includes(normalizedQuery))
          score += 10;
        return { event, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    return scored
      .filter((item): item is { event: TempleEvent & { id: string }; score: number } => item.event.id !== undefined)
      .map(({ event, score }) => ({
        id: event.id!,
        type: "event" as SearchResultType,
        title: event.title,
        description: (event.description || "").slice(0, 150),
        url: `/events/${event.id}`,
        relevanceScore: score,
        matchedKeywords: [] as string[],
        category: "Events",
      }));
  } catch {
    return [];
  }
}

/**
 * Search festivals
 */
async function searchFestivals(
  query: string,
  maxResults: number
): Promise<SearchResult[]> {
  try {
    const events = await eventService.getEvents();
    const normalizedQuery = query.toLowerCase();

    const festivals = events.filter(
      (event) =>
        event.category === "festival" ||
        event.title.toLowerCase().includes("utsav") ||
        event.title.toLowerCase().includes("festival")
    );

    const scored: Array<{ event: TempleEvent; score: number }> = festivals
      .filter((event) => {
        const title = event.title.toLowerCase();
        const description = (event.description || "").toLowerCase();
        return (
          title.includes(normalizedQuery) || description.includes(normalizedQuery)
        );
      })
      .map((event) => {
        let score = 0;
        if (event.title.toLowerCase().includes(normalizedQuery)) score += 20;
        if ((event.description || "").toLowerCase().includes(normalizedQuery))
          score += 10;
        return { event, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    return scored
      .filter((item): item is { event: TempleEvent & { id: string }; score: number } => item.event.id !== undefined)
      .map(({ event, score }) => ({
        id: event.id!,
        type: "festival" as SearchResultType,
        title: event.title,
        description: (event.description || "").slice(0, 150),
        url: `/events/${event.id}`,
        relevanceScore: score,
        matchedKeywords: [] as string[],
        category: "Festival",
      }));
  } catch {
    return [];
  }
}

/**
 * Search gallery
 */
async function searchGallery(
  query: string,
  maxResults: number
): Promise<SearchResult[]> {
  try {
    const media = await galleryService.getMedia();
    const normalizedQuery = query.toLowerCase();

    const scored: Array<{ item: GalleryMedia; score: number }> = media
      .filter((item) => {
        const title = (item.title || "").toLowerCase();
        const description = (item.description || "").toLowerCase();
        const category = (item.category || "").toLowerCase();
        return (
          title.includes(normalizedQuery) ||
          description.includes(normalizedQuery) ||
          category.includes(normalizedQuery)
        );
      })
      .map((item) => {
        let score = 0;
        if ((item.title || "").toLowerCase().includes(normalizedQuery)) score += 20;
        if ((item.description || "").toLowerCase().includes(normalizedQuery))
          score += 10;
        if ((item.category || "").toLowerCase().includes(normalizedQuery))
          score += 15;
        return { item, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    return scored
      .filter((item): item is { item: GalleryMedia & { id: string }; score: number } => item.item.id !== undefined)
      .map(({ item, score }) => ({
        id: item.id!,
        type: "gallery" as SearchResultType,
        title: item.title || "Gallery Image",
        description: (item.description || "").slice(0, 150),
        url: `/gallery`,
        imageUrl: item.imagePath,
        relevanceScore: score,
        matchedKeywords: [] as string[],
        category: item.category,
      }));
  } catch {
    return [];
  }
}

/**
 * Search FAQs from knowledge
 */
async function searchFAQs(
  query: string,
  maxResults: number
): Promise<SearchResult[]> {
  try {
    const results = await knowledgeService.searchKnowledge(query, maxResults);

    return results
      .filter((r) => r.article.category === "faq")
      .map((result) => ({
        id: result.article.id,
        type: "faq" as SearchResultType,
        title: result.article.title,
        description: result.article.content.slice(0, 150) + "...",
        url: `/knowledge/article/${result.article.slug}`,
        relevanceScore: result.relevanceScore,
        matchedKeywords: result.matchedKeywords,
        category: "FAQ",
      }));
  } catch {
    return [];
  }
}

/**
 * Get search suggestions based on query
 */
export async function getSearchSuggestions(
  query: string,
  maxSuggestions = 5
): Promise<SearchSuggestion[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const suggestions: SearchSuggestion[] = [];
  const normalizedQuery = query.toLowerCase();

  // Common search suggestions
  const commonSuggestions = [
    "Sri Raghavendra Swamy",
    "Guru Parampara",
    "Madhwa Philosophy",
    "Temple History",
    "Festival",
    "Pooja Schedule",
    "Donation",
  ];

  commonSuggestions
    .filter((s) => s.toLowerCase().includes(normalizedQuery))
    .slice(0, 3)
    .forEach((s) => {
      suggestions.push({
        text: s,
        type: "query",
      });
    });

  // Category suggestions
  const categories = Object.entries(SEARCH_TYPE_CONFIG);
  categories
    .filter(([, config]) => config.label.toLowerCase().includes(normalizedQuery))
    .slice(0, 2)
    .forEach(([type, config]) => {
      suggestions.push({
        text: config.label,
        type: "category",
        url: getCategoryUrl(type as SearchResultType),
      });
    });

  return suggestions.slice(0, maxSuggestions);
}

/**
 * Get URL for a search result type category
 */
function getCategoryUrl(type: SearchResultType): string {
  switch (type) {
    case "knowledge":
      return "/knowledge";
    case "guru":
      return "/guruparampara";
    case "event":
      return "/events";
    case "festival":
      return "/calendar/festivals";
    case "gallery":
      return "/gallery";
    case "faq":
      return "/knowledge/faq";
    case "announcement":
      return "/";
    default:
      return "/";
  }
}

/**
 * Group search results by type
 */
export function groupResultsByType(
  results: SearchResult[]
): Record<SearchResultType, SearchResult[]> {
  const grouped: Record<SearchResultType, SearchResult[]> = {
    knowledge: [],
    guru: [],
    event: [],
    festival: [],
    gallery: [],
    faq: [],
    announcement: [],
  };

  results.forEach((result) => {
    grouped[result.type].push(result);
  });

  return grouped;
}

/**
 * Highlight matched keywords in text
 */
export function highlightKeywords(
  text: string,
  keywords: string[],
  className = "bg-amber-200"
): string {
  if (!keywords.length) return text;

  let result = text;
  keywords.forEach((keyword) => {
    const regex = new RegExp(`(${keyword})`, "gi");
    result = result.replace(regex, `<mark class="${className}">$1</mark>`);
  });

  return result;
}

/**
 * Get empty state suggestions based on popular content
 */
export async function getEmptyStateSuggestions(): Promise<SearchSuggestion[]> {
  return [
    { text: "Sri Raghavendra Swamy", type: "query" },
    { text: "Guru Parampara", type: "query" },
    { text: "Madhwa Philosophy", type: "query" },
    { text: "Temple History", type: "query" },
    { text: "Pooja Schedule", type: "query" },
    { text: "Festivals", type: "category", url: "/calendar/festivals" },
    { text: "Donation", type: "query" },
  ];
}
