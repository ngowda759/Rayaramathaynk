/**
 * Quote Service - Intelligent Devotional Quote Engine
 * Epic: Intelligent Devotional Quote Engine for Sri Raghavendra Swamy Temple
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  FirestoreError,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Quote,
  QuoteCategory,
  QuoteFilters,
  QuoteSelectionContext,
  QuoteResponse,
  QuotePriority,
  WEEKDAY_QUOTE_MAP,
  FESTIVAL_QUOTE_MAP,
  DEFAULT_QUOTES_DATA,
  PanchangaRules,
  FestivalName,
  Weekday,
} from "@/types/quote";
import { eventService } from "./event.service";
import { Timestamp } from "firebase/firestore";

const COLLECTION = "quotes";
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// In-memory cache for today's quote
let quoteCache: {
  quote: Quote | null;
  timestamp: number;
  date: string;
} | null = null;

/**
 * Convert Firestore document to Quote
 */
function docToQuote(id: string, data: any): Quote {
  return {
    id,
    slug: data.slug || "",
    title: data.title || "",
    category: data.category || "devotional_sayings",
    priority: data.priority || 5,
    language: data.language || "en",
    content: data.content || {},
    source: data.source || "",
    author: data.author,
    verseNumber: data.verseNumber,
    tags: data.tags || [],
    active: data.active ?? true,
    featured: data.featured ?? false,
    festivalOnly: data.festivalOnly ?? false,
    festivalNames: data.festivalNames || [],
    weekdayOnly: data.weekdayOnly ?? null,
    panchangaRules: data.panchangaRules,
    eventRules: data.eventRules,
    displayFrom: data.displayFrom,
    displayTo: data.displayTo,
    displayWeight: data.displayWeight || 1,
    rotationGroup: data.rotationGroup,
    stats: data.stats || { viewCount: 0 },
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || new Date().toISOString(),
    createdBy: data.createdBy,
  };
}

/**
 * Get date string in YYYY-MM-DD format (IST)
 */
function getDateString(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/**
 * Check if cache is valid for today
 */
function isCacheValid(): boolean {
  if (!quoteCache) return false;
  const today = getDateString();
  return quoteCache.date === today && Date.now() - quoteCache.timestamp < CACHE_DURATION;
}

class QuoteService {
  /**
   * Get all quotes with optional filters
   */
  async getQuotes(filters?: QuoteFilters): Promise<Quote[]> {
    if (!db) {
      console.log("[QuoteService] Firebase not configured, returning empty array");
      return [];
    }

    try {
      const constraints: any[] = [where("active", "==", filters?.active ?? true)];

      if (filters?.category) {
        constraints.push(where("category", "==", filters.category));
      }

      if (filters?.language) {
        constraints.push(where("language", "==", filters.language));
      }

      if (filters?.featured !== undefined) {
        constraints.push(where("featured", "==", filters.featured));
      }

      if (filters?.festivalOnly !== undefined) {
        constraints.push(where("festivalOnly", "==", filters.festivalOnly));
      }

      if (filters?.weekdayOnly !== undefined) {
        constraints.push(where("weekdayOnly", "==", filters.weekdayOnly));
      }

      const q = query(collection(db, COLLECTION), ...constraints, orderBy("priority", "asc"));
      const snapshot = await getDocs(q);

      let quotes = snapshot.docs.map((d) => docToQuote(d.id, d.data()));

      // Apply text search if provided
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        quotes = quotes.filter(
          (q) =>
            q.title.toLowerCase().includes(searchLower) ||
            q.source.toLowerCase().includes(searchLower) ||
            q.tags.some((t) => t.toLowerCase().includes(searchLower)) ||
            q.content.kannada?.toLowerCase().includes(searchLower) ||
            q.content.translationEnglish?.toLowerCase().includes(searchLower)
        );
      }

      // Apply tag filter
      if (filters?.tags && filters.tags.length > 0) {
        quotes = quotes.filter((q) =>
          filters.tags!.some((tag) => q.tags.includes(tag))
        );
      }

      return quotes;
    } catch (error) {
      console.error("[QuoteService] Error fetching quotes:", error);
      return [];
    }
  }

  /**
   * Get a single quote by ID
   */
  async getQuoteById(id: string): Promise<Quote | null> {
    if (!db) return null;

    try {
      const snap = await getDoc(doc(db, COLLECTION, id));
      if (!snap.exists()) return null;
      return docToQuote(snap.id, snap.data());
    } catch (error) {
      console.error("[QuoteService] Error fetching quote:", error);
      return null;
    }
  }

  /**
   * Get a quote by slug
   */
  async getQuoteBySlug(slug: string): Promise<Quote | null> {
    if (!db) return null;

    try {
      const q = query(collection(db, COLLECTION), where("slug", "==", slug), limit(1));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      const docSnap = snapshot.docs[0];
      return docToQuote(docSnap.id, docSnap.data());
    } catch (error) {
      console.error("[QuoteService] Error fetching quote by slug:", error);
      return null;
    }
  }

  /**
   * Create a new quote
   */
  async createQuote(quote: Omit<Quote, "id" | "createdAt" | "updatedAt">): Promise<string> {
    if (!db) throw new Error("Firebase not configured");

    const now = new Date().toISOString();
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...quote,
      stats: { viewCount: 0 },
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    });

    return docRef.id;
  }

  /**
   * Update an existing quote
   */
  async updateQuote(id: string, updates: Partial<Quote>): Promise<void> {
    if (!db) throw new Error("Firebase not configured");

    const { id: _, createdAt: __, ...cleanUpdates } = updates;
    
    await updateDoc(doc(db, COLLECTION, id), {
      ...cleanUpdates,
      updatedAt: Timestamp.fromDate(new Date()),
    });
  }

  /**
   * Delete a quote
   */
  async deleteQuote(id: string): Promise<void> {
    if (!db) throw new Error("Firebase not configured");
    await deleteDoc(doc(db, COLLECTION, id));
  }

  /**
   * Build selection context from current date and events
   */
  async buildSelectionContext(date: Date = new Date()): Promise<QuoteSelectionContext> {
    const dayOfWeek = date.getDay() as Weekday;
    
    // Get today's events from Firestore
    let activeEvents: QuoteSelectionContext["activeEvents"] = [];
    try {
      const todayStr = getDateString(date);
      const todayStart = new Date(todayStr);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStr);
      todayEnd.setHours(23, 59, 59, 999);

      const events = await eventService.getPublishedEvents();
      activeEvents = events
        .filter((event) => {
          const startDate = event.startDate instanceof Timestamp 
            ? event.startDate.toDate() 
            : new Date(event.startDate as any);
          const endDate = event.endDate instanceof Timestamp 
            ? event.endDate.toDate() 
            : new Date(event.endDate as any);
          return startDate <= todayEnd && endDate >= todayStart;
        })
        .map((event) => ({
          id: event.id!,
          title: (typeof event.title === 'object' && event.title !== null) ? (event.title as {en?: string; kn?: string}).en || (event.title as {en?: string; kn?: string}).kn || "" : String(event.title || ""),
          category: event.category || "",
        }));
    } catch (error) {
      console.error("[QuoteService] Error fetching events:", error);
    }

    // Determine if it's a festival day
    const isFestival = activeEvents.some(
      (e) =>
        e.title.toLowerCase().includes("aradhana") ||
        e.title.toLowerCase().includes("festival") ||
        e.title.toLowerCase().includes("utsava") ||
        e.category === "festival"
    );

    // Extract festival name
    let festivalName: string | undefined;
    if (isFestival) {
      const festivalEvent = activeEvents.find(
        (e) =>
          e.title.toLowerCase().includes("aradhana") ||
          e.category === "festival"
      );
      festivalName = festivalEvent?.title;
    }

    return {
      date,
      dayOfWeek,
      isFestival,
      festivalName,
      activeEvents,
    };
  }

  /**
   * Get quotes matching specific criteria
   */
  async getQuotesByCriteria(criteria: {
    category?: QuoteCategory;
    festivalNames?: FestivalName[];
    weekdays?: Weekday[];
    featured?: boolean;
    active?: boolean;
  }): Promise<Quote[]> {
    const allQuotes = await this.getQuotes({ active: criteria.active ?? true });

    return allQuotes.filter((quote) => {
      if (criteria.category && quote.category !== criteria.category) return false;
      if (criteria.featured !== undefined && quote.featured !== criteria.featured) return false;
      if (criteria.festivalNames && criteria.festivalNames.length > 0) {
        const hasMatch = criteria.festivalNames.some((f) => quote.festivalNames.includes(f));
        if (!hasMatch) return false;
      }
      if (criteria.weekdays && criteria.weekdays.length > 0) {
        if (quote.weekdayOnly === null || !criteria.weekdays.includes(quote.weekdayOnly)) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Select the best quote based on context and priority rules
   */
  async selectQuote(context: QuoteSelectionContext): Promise<Quote | null> {
    const today = getDateString(context.date);

    // 1. Check for event-specific quotes (highest priority)
    if (context.activeEvents && context.activeEvents.length > 0) {
      const eventQuotes = await this.getQuotesByCriteria({
        festivalNames: context.activeEvents
          .map((e) => e.title.toLowerCase().includes("aradhana") ? "raghavendra_aradhana" : undefined)
          .filter(Boolean) as FestivalName[],
      });

      if (eventQuotes.length > 0) {
        const selected = this.deterministicSelect(eventQuotes, today);
        if (selected) {
          console.log("[QuoteService] Selected event-specific quote:", selected.id);
          return selected;
        }
      }
    }

    // 2. Check for festival-specific quotes
    if (context.isFestival && context.festivalName) {
      const festivalKey = this.matchFestivalName(context.festivalName);
      if (festivalKey) {
        const festivalQuotes = await this.getQuotesByCriteria({
          festivalNames: [festivalKey],
          active: true,
        });

        if (festivalQuotes.length > 0) {
          const selected = this.deterministicSelect(festivalQuotes, today);
          if (selected) {
            console.log("[QuoteService] Selected festival quote:", selected.id);
            return selected;
          }
        }
      }
    }

    // 3. Check for Guru Purnima quotes
    if (context.festivalName?.toLowerCase().includes("guru purnima")) {
      const guruQuotes = await this.getQuotesByCriteria({
        category: "mangalashtakam",
        active: true,
      });

      if (guruQuotes.length > 0) {
        const selected = this.deterministicSelect(guruQuotes, today);
        if (selected) {
          console.log("[QuoteService] Selected Guru Purnima quote:", selected.id);
          return selected;
        }
      }
    }

    // 4. Check for Thursday Guru Vandana
    if (context.dayOfWeek === 4) { // Thursday
      const guruVandanaQuotes = await this.getQuotesByCriteria({
        category: "guru_vandana",
        active: true,
      });

      if (guruVandanaQuotes.length > 0) {
        const selected = this.deterministicSelect(guruVandanaQuotes, today);
        if (selected) {
          console.log("[QuoteService] Selected Guru Vandana quote:", selected.id);
          return selected;
        }
      }
    }

    // 5. Check for weekday-specific quotes
    const weekdayCategory = WEEKDAY_QUOTE_MAP[context.dayOfWeek];
    if (weekdayCategory) {
      const weekdayQuotes = await this.getQuotesByCriteria({
        category: weekdayCategory,
        active: true,
      });

      if (weekdayQuotes.length > 0) {
        const selected = this.deterministicSelect(weekdayQuotes, today);
        if (selected) {
          console.log("[QuoteService] Selected weekday quote:", selected.id);
          return selected;
        }
      }
    }

    // 6. Default to Sri Raghavendra Stotra
    const stotraQuotes = await this.getQuotesByCriteria({
      category: "raghavendra_stotra",
      active: true,
    });

    if (stotraQuotes.length > 0) {
      const selected = this.deterministicSelect(stotraQuotes, today);
      if (selected) {
        console.log("[QuoteService] Selected Stotra quote:", selected.id);
        return selected;
      }
    }

    // 7. Fall back to any active quote
    let allActiveQuotes = await this.getQuotes({ active: true });
    
    // Auto-seed if no quotes exist in the database
    if (allActiveQuotes.length === 0) {
      console.log("[QuoteService] No quotes found, auto-seeding default quotes...");
      const seeded = await this.seedDefaultQuotes();
      if (seeded > 0) {
        allActiveQuotes = await this.getQuotes({ active: true });
        console.log(`[QuoteService] Auto-seeded ${seeded} quotes`);
      }
    }
    
    if (allActiveQuotes.length > 0) {
      const selected = this.deterministicSelect(allActiveQuotes, today);
      if (selected) {
        console.log("[QuoteService] Selected fallback quote:", selected.id);
        return selected;
      }
    }

    console.log("[QuoteService] No quotes found, returning null");
    return null;
  }

  /**
   * Match festival name to enum value
   */
  private matchFestivalName(name: string): FestivalName | null {
    const nameLower = name.toLowerCase();
    
    if (nameLower.includes("aradhana")) return "raghavendra_aradhana";
    if (nameLower.includes("guru purnima")) return "guru_purnima";
    if (nameLower.includes("madhwa navami") || nameLower.includes("madwa navami")) return "madhwa_navami";
    if (nameLower.includes("vyasa")) return "vyasa_pooja";
    if (nameLower.includes("rama navami")) return "rama_navami";
    if (nameLower.includes("krishna") && nameLower.includes("janmashtami")) return "krishna_janmashtami";
    if (nameLower.includes("narasimha") || nameLower.includes("narasimba")) return "narasimha_jayanti";
    if (nameLower.includes("hanuman")) return "hanuman_jayanti";
    if (nameLower.includes("deepavali") || nameLower.includes("diwali")) return "deepavali";
    if (nameLower.includes("vaikuntha")) return "vaikuntha_ekadashi";
    if (nameLower.includes("brahmotsava") || nameLower.includes("utsava")) return "brahmotsava";
    if (nameLower.includes("navaratri") || nameLower.includes("navratri")) return "navaratri";
    if (nameLower.includes("mahashivaratri") || nameLower.includes("shivaratri")) return "mahashivaratri";
    if (nameLower.includes("ratha saptami")) return "ratha_saptami";
    if (nameLower.includes("makara sankramana") || nameLower.includes("sankranti")) return "makara_sankramana";
    
    return null;
  }

  /**
   * Deterministic selection based on date (same date = same quote)
   */
  private deterministicSelect(quotes: Quote[], dateStr: string): Quote | null {
    if (quotes.length === 0) return null;

    // Use date string to create a deterministic index
    const dateNum = dateStr.split("-").join("").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const featuredQuotes = quotes.filter((q) => q.featured);
    const nonFeaturedQuotes = quotes.filter((q) => !q.featured);

    if (featuredQuotes.length > 0) {
      const index = dateNum % featuredQuotes.length;
      return featuredQuotes[index];
    }

    const index = dateNum % quotes.length;
    return quotes[index];
  }

  /**
   * Get today's quote (with caching)
   */
  async getTodaysQuote(date: Date = new Date()): Promise<QuoteResponse> {
    const today = getDateString(date);

    // Check cache
    if (quoteCache && quoteCache.date === today) {
      console.log("[QuoteService] Returning cached quote for:", today);
      return {
        quote: quoteCache.quote,
        context: {
          category: quoteCache.quote?.category || "devotional_sayings",
          reason: this.getSelectionReason(quoteCache.quote?.category, date.getDay()),
        },
        metadata: {
          cached: true,
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Build context and select quote
    const context = await this.buildSelectionContext(date);
    const quote = await this.selectQuote(context);

    // Update cache
    quoteCache = {
      quote,
      timestamp: Date.now(),
      date: today,
    };

    // Increment view count if quote exists
    if (quote) {
      this.incrementViewCount(quote.id).catch((err) => {
        console.error("[QuoteService] Error incrementing view count:", err);
      });
    }

    return {
      quote,
      context: {
        category: quote?.category || "devotional_sayings",
        reason: this.getSelectionReason(quote?.category, date.getDay()),
      },
      metadata: {
        cached: false,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Get human-readable selection reason
   */
  private getSelectionReason(category: QuoteCategory | undefined, dayOfWeek: number): string {
    if (!category) return "Default fallback";

    switch (category) {
      case "raghavendra_stotra":
        return "Sri Raghavendra Stotra - Daily verse";
      case "mangalashtakam":
        return "Festival verse - Special occasion";
      case "guru_vandana":
        return "Guru Vandana - Thursday worship";
      case "authentic_teachings":
        return "Authentic teachings from Sri Raghavendra";
      case "madhwa_philosophy":
        return "Madhwa Dvaita philosophy";
      case "devotional_sayings":
        return "Devotional reflection";
      default:
        return "Selected quote";
    }
  }

  /**
   * Increment view count for a quote
   */
  async incrementViewCount(id: string): Promise<void> {
    if (!db) return;

    try {
      const quote = await this.getQuoteById(id);
      if (quote) {
        await updateDoc(doc(db, COLLECTION, id), {
          "stats.viewCount": (quote.stats?.viewCount || 0) + 1,
          "stats.lastViewedAt": new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("[QuoteService] Error incrementing view count:", error);
    }
  }

  /**
   * Get quotes by category
   */
  async getQuoteByCategory(category: QuoteCategory): Promise<Quote[]> {
    return this.getQuotes({ category });
  }

  /**
   * Get featured quotes
   */
  async getFeaturedQuotes(): Promise<Quote[]> {
    return this.getQuotes({ featured: true });
  }

  /**
   * Get quotes by festival
   */
  async getFestivalQuote(festivalName: FestivalName): Promise<Quote[]> {
    return this.getQuotesByCriteria({
      festivalNames: [festivalName],
      active: true,
    });
  }

  /**
   * Get quotes for Panchanga rules
   */
  async getPanchangaQuote(panchangaRules: PanchangaRules): Promise<Quote[]> {
    const allQuotes = await this.getQuotes({ active: true });

    return allQuotes.filter((quote) => {
      if (!quote.panchangaRules) return false;

      const qr = quote.panchangaRules;

      if (qr.tithis && qr.tithis.length > 0 && !panchangaRules.tithis?.some((t) => qr.tithis!.includes(t))) {
        return false;
      }

      if (qr.nakshatras && qr.nakshatras.length > 0 && !panchangaRules.nakshatras?.some((n) => qr.nakshatras!.includes(n))) {
        return false;
      }

      if (qr.weekdays && qr.weekdays.length > 0 && !panchangaRules.weekdays?.some((w) => qr.weekdays!.includes(w))) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get quotes for specific events
   */
  async getEventQuote(eventId: string): Promise<Quote[]> {
    const allQuotes = await this.getQuotes({ active: true });

    return allQuotes.filter((quote) => {
      if (!quote.eventRules) return false;
      return quote.eventRules.eventIds?.includes(eventId);
    });
  }

  /**
   * Get Thursday-specific quotes
   */
  async getThursdayQuote(): Promise<Quote[]> {
    return this.getQuotesByCriteria({
      category: "guru_vandana",
      weekdays: [4],
      active: true,
    });
  }

  /**
   * Get fallback quotes
   */
  async getFallbackQuote(): Promise<Quote[]> {
    return this.getQuotes({ category: "devotional_sayings" });
  }

  /**
   * Get random quote
   */
  async getRandomQuote(): Promise<Quote | null> {
    const quotes = await this.getQuotes({ active: true });
    if (quotes.length === 0) return null;
    const index = Math.floor(Math.random() * quotes.length);
    return quotes[index];
  }

  /**
   * Get quote by specific date
   */
  async getQuoteByDate(dateStr: string): Promise<QuoteResponse> {
    const date = new Date(dateStr);
    return this.getTodaysQuote(date);
  }

  /**
   * Get upcoming festival quotes
   */
  async getUpcomingFestivalQuotes(maxFestivals = 3): Promise<Array<{ festival: string; quotes: Quote[] }>> {
    const festivals: FestivalName[] = [
      "raghavendra_aradhana",
      "guru_purnima",
      "madhwa_navami",
      "vyasa_pooja",
    ];

    const results: Array<{ festival: string; quotes: Quote[] }> = [];

    for (const festival of festivals.slice(0, maxFestivals)) {
      const quotes = await this.getFestivalQuote(festival);
      if (quotes.length > 0) {
        results.push({
          festival,
          quotes,
        });
      }
    }

    return results;
  }

  /**
   * Search quotes
   */
  async searchQuotes(searchTerm: string): Promise<Quote[]> {
    return this.getQuotes({ search: searchTerm });
  }

  /**
   * Get rotation preview for upcoming days
   */
  async getRotationPreview(days = 7): Promise<Array<{ date: string; quote: Quote | null }>> {
    const results: Array<{ date: string; quote: Quote | null }> = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const context = await this.buildSelectionContext(date);
      const quote = await this.selectQuote(context);
      results.push({
        date: getDateString(date),
        quote,
      });
    }

    return results;
  }

  /**
   * Seed default quotes if collection is empty
   */
  async seedDefaultQuotes(): Promise<number> {
    if (!db) {
      console.log("[QuoteService] Firebase not configured, cannot seed");
      return 0;
    }

    try {
      // Check if quotes already exist
      const existingQuotes = await this.getQuotes({ active: true });
      if (existingQuotes.length > 0) {
        console.log("[QuoteService] Quotes already exist, skipping seed");
        return 0;
      }

      // Create default quotes
      let created = 0;
      for (const quoteData of DEFAULT_QUOTES_DATA) {
        await this.createQuote({
          ...quoteData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any);
        created++;
      }

      console.log(`[QuoteService] Seeded ${created} default quotes`);
      return created;
    } catch (error) {
      console.error("[QuoteService] Error seeding quotes:", error);
      return 0;
    }
  }

  /**
   * Bulk import quotes
   */
  async bulkImport(quotes: Omit<Quote, "id" | "createdAt" | "updatedAt">[]): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;

    for (let i = 0; i < quotes.length; i++) {
      try {
        const quote = quotes[i];
        if (!quote.title || !quote.category || !quote.source) {
          errors.push(`Quote at index ${i}: Missing required fields (title, category, source)`);
          continue;
        }

        await this.createQuote({
          ...quote,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any);
        imported++;
      } catch (error: any) {
        errors.push(`Quote at index ${i}: ${error.message}`);
      }
    }

    return { imported, errors };
  }

  /**
   * Get all unique tags
   */
  async getAllTags(): Promise<string[]> {
    const quotes = await this.getQuotes();
    const tagSet = new Set<string>();
    quotes.forEach((q) => q.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }

  /**
   * Get quote statistics
   */
  async getQuoteStats(): Promise<{
    total: number;
    byCategory: Record<QuoteCategory, number>;
    featured: number;
    active: number;
    topViewed: Quote[];
  }> {
    const quotes = await this.getQuotes();

    const byCategory: Record<QuoteCategory, number> = {
      raghavendra_stotra: 0,
      mangalashtakam: 0,
      guru_vandana: 0,
      authentic_teachings: 0,
      devotional_sayings: 0,
      madhwa_philosophy: 0,
    };

    quotes.forEach((q) => {
      byCategory[q.category]++;
    });

    const topViewed = [...quotes]
      .sort((a, b) => (b.stats?.viewCount || 0) - (a.stats?.viewCount || 0))
      .slice(0, 5);

    return {
      total: quotes.length,
      byCategory,
      featured: quotes.filter((q) => q.featured).length,
      active: quotes.filter((q) => q.active).length,
      topViewed,
    };
  }

  /**
   * Clear the quote cache
   */
  clearCache(): void {
    quoteCache = null;
    console.log("[QuoteService] Cache cleared");
  }
}

export const quoteService = new QuoteService();
