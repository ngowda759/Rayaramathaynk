import "server-only";

/**
 * Daily Spiritual Dashboard Service
 * Epic 1: Fetches and combines all daily spiritual data for the homepage dashboard
 */

import { createClient } from "@/lib/supabase/client";
import {
  TempleStatus,
  DailyQuote,
  FeaturedEvent,
  DailySpiritualDashboard,
} from "@/types/daily-spiritual";
import type { Announcement } from "@/types/announcement";
import { homepageService } from "./homepage.server";
import { quoteService } from "./quote.server";

/**
 * Parse time string to minutes from midnight
 */
function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const cleanTime = timeStr.replace(/\s*(AM|PM|am|pm)\s*/i, "").trim();
  const [hours, minutes] = cleanTime.split(":").map(Number);
  if (timeStr.toLowerCase().includes("pm") && hours !== 12) {
    return (hours + 12) * 60 + (minutes || 0);
  }
  if (timeStr.toLowerCase().includes("am") && hours === 12) {
    return minutes || 0;
  }
  return hours * 60 + (minutes || 0);
}

/**
 * Get current IST time in minutes from midnight
 * IST is UTC+5:30
 * Uses Intl.DateTimeFormat to reliably get the time in Asia/Kolkata timezone
 */
function getCurrentMinutes(): number {
  const now = new Date();
  // Use Intl to get the actual IST time reliably, regardless of server timezone
  const istTimeString = now.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  });
  const [hours, minutes] = istTimeString.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Get current time formatted for IST display
 */
function getCurrentTimeIST(): string {
  const now = new Date();
  return now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

/**
 * Convert a date value (ISO string, epoch seconds, or Date) to a Date
 */
function timestampToDate(timestamp: any): Date {
  if (!timestamp) return new Date();
  if (timestamp.toDate && typeof timestamp.toDate === "function") {
    return timestamp.toDate();
  }
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000);
  }
  return new Date(timestamp);
}

class DailySpiritualService {
  /**
   * Get temple open/closed status with current time
   */
  async getTempleStatus(): Promise<TempleStatus> {
    const currentTime = getCurrentTimeIST();

    let morningOpen = "06:00 AM";
    let morningClose = "01:00 PM";
    let eveningOpen = "01:00 PM";
    let eveningClose = "08:30 PM";
    let isTempleOpen = true;

    // Try to get settings from homepage config
    try {
      const homepage = await homepageService.getHomepage();
      morningOpen = homepage.morningOpen || morningOpen;
      morningClose = homepage.morningClose || morningClose;
      eveningOpen = homepage.eveningOpen || eveningOpen;
      eveningClose = homepage.eveningClose || eveningClose;
      isTempleOpen = homepage.isTempleOpen ?? true;
    } catch {
      // Use defaults
    }

    const currentMinutes = getCurrentMinutes();
    const morningOpenMinutes = parseTimeToMinutes(morningOpen);
    const morningCloseMinutes = parseTimeToMinutes(morningClose);
    const eveningOpenMinutes = parseTimeToMinutes(eveningOpen);
    const eveningCloseMinutes = parseTimeToMinutes(eveningClose);

    let session: "morning" | "evening" | "closed" = "closed";
    let nextOpenTime: string | undefined;
    let message: string | undefined;

    // First, calculate the natural session based on current time
    if (currentMinutes >= morningOpenMinutes && currentMinutes < morningCloseMinutes) {
      session = "morning";
    } else if (currentMinutes >= eveningOpenMinutes && currentMinutes < eveningCloseMinutes) {
      session = "evening";
    } else {
      session = "closed";
    }

    // Determine next open time based on current time
    if (currentMinutes < morningOpenMinutes) {
      nextOpenTime = morningOpen;
    } else if (currentMinutes >= morningCloseMinutes && currentMinutes < eveningOpenMinutes) {
      nextOpenTime = eveningOpen;
    } else if (currentMinutes >= eveningCloseMinutes) {
      // After evening close, next open is tomorrow morning
      nextOpenTime = morningOpen;
    }

    // Now apply the isTempleOpen override
    if (isTempleOpen) {
      if (session === "morning") {
        message = "Morning Darshan in progress";
      } else if (session === "evening") {
        message = "Evening Darshan in progress";
      } else if (currentMinutes < morningOpenMinutes) {
        message = `Opens at ${morningOpen}`;
      } else if (currentMinutes >= morningCloseMinutes && currentMinutes < eveningOpenMinutes) {
        message = `Opens at ${eveningOpen}`;
      } else {
        message = "Temple closed for the day";
      }
    } else {
      // Temple is temporarily closed but still show next scheduled opening
      message = "Temple temporarily closed";
    }

    return {
      isOpen: isTempleOpen && session !== "closed",
      currentTime,
      morningOpen,
      morningClose,
      eveningOpen,
      eveningClose,
      session,
      nextOpenTime,
      message,
    };
  }

  /**
   * Get daily quote from homepage config or use intelligent quote engine
   * 
   * Priority:
   * 1. Custom quote from homepage settings (if text is set)
   * 2. Intelligent quote selection based on:
   *    - Festival quotes (highest priority)
   *    - Thursday: Guru Vandana
   *    - Weekday-based rotation (Sri Raghavendra Stotra, Authentic Teachings, Madhwa Philosophy)
   *    - Fallback: Devotional Sayings
   */
  async getDailyQuote(): Promise<DailyQuote | null> {
    try {
      const homepage = await homepageService.getHomepage();
      
      // Use homepage config quote if available
      if (homepage.dailyQuote?.text) {
        return {
          id: "custom",
          text: homepage.dailyQuote.text,
          source: homepage.dailyQuote.source || "Sri Raghavendra Swamy",
          language: "mixed",
          category: "devotion",
        };
      }
    } catch (error) {
      console.error("Error fetching quote from homepage:", error);
    }

    // Use the intelligent quote engine for automatic scheduling
    try {
      const result = await quoteService.getTodaysQuote();
      
      if (result.quote) {
        // Format the intelligent quote to DailyQuote format
        const q = result.quote;
        return {
          id: q.id,
          text: q.content.translationEnglish || q.content.kannada || q.content.sanskrit || q.title,
          source: q.source,
          language: q.content.kannada ? "kn" : "en",
          category: q.category,
        };
      }
    } catch (error) {
      console.error("Error fetching quote from quote service:", error);
    }

    return null;
  }

  /**
   * Get featured event from homepage config or the events table
   */
  async getFeaturedEvent(): Promise<FeaturedEvent | null> {
    // First try to get from homepage config
    try {
      const homepage = await homepageService.getHomepage();
      
      if (homepage.dashboardFeaturedEvent?.title) {
        return {
          id: "custom",
          title: homepage.dashboardFeaturedEvent.title,
          description: homepage.dashboardFeaturedEvent.description || "",
          isToday: homepage.dashboardFeaturedEvent.isOngoing ?? false,
          isOngoing: homepage.dashboardFeaturedEvent.isOngoing ?? false,
          daysRemaining: homepage.dashboardFeaturedEvent.daysRemaining,
          category: "event",
        };
      }

      // Fallback to featuredFestival from homepage
      if (homepage.featuredFestival) {
        return {
          id: "featured",
          title: homepage.featuredFestival,
          description: homepage.featuredFestivalDescription || "",
          isToday: false,
          isOngoing: false,
          daysRemaining: homepage.festivalDate ? this.calculateDaysRemaining(homepage.festivalDate) : undefined,
          category: "event",
        };
      }
    } catch (error) {
      console.error("Error fetching featured event from homepage:", error);
    }

    // Fallback to the events table
    return this.getFeaturedEventFromSupabase();
  }

  /**
   * Calculate days remaining from a date string
   */
  private calculateDaysRemaining(dateStr: string): number | undefined {
    try {
      const eventDate = new Date(dateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      eventDate.setHours(0, 0, 0, 0);
      const diff = eventDate.getTime() - today.getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return days > 0 ? days : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Get featured event from the events table
   */
  private async getFeaturedEventFromSupabase(): Promise<FeaturedEvent | null> {
    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("published", true);
      if (error) throw new Error(error.message);

      const rows = data ?? [];

      // Prefer a featured event that has not ended.
      for (const row of rows) {
        if (!row.featured) continue;
        const startDate = timestampToDate(row.start_date);
        const endDate = timestampToDate(row.end_date);
        if (endDate >= todayStart) {
          const isToday = startDate <= todayEnd && endDate >= todayStart;
          const daysRemaining = isToday
            ? 0
            : Math.ceil((startDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
          return {
            id: row.firestore_id || row.id,
            title: row.title || "",
            description: row.description || "",
            startDate,
            endDate,
            startTime: row.start_time,
            endTime: row.end_time,
            category: row.category || "event",
            imageUrl: row.image_url,
            isToday,
            isOngoing: isToday,
            daysRemaining: daysRemaining > 0 ? daysRemaining : undefined,
          };
        }
      }

      // Otherwise the closest upcoming event.
      let closestEvent: FeaturedEvent | null = null;
      let closestDaysRemaining = Infinity;
      for (const row of rows) {
        const startDate = timestampToDate(row.start_date);
        const endDate = timestampToDate(row.end_date);
        if (endDate >= todayStart) {
          const isToday = startDate <= todayEnd && endDate >= todayStart;
          const daysRemaining = isToday
            ? 0
            : Math.ceil((startDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
          if (daysRemaining < closestDaysRemaining) {
            closestDaysRemaining = daysRemaining;
            closestEvent = {
              id: row.firestore_id || row.id,
              title: row.title || "",
              description: row.description || "",
              startDate,
              endDate,
              startTime: row.start_time,
              endTime: row.end_time,
              category: row.category || "event",
              imageUrl: row.image_url,
              isToday,
              isOngoing: isToday,
              daysRemaining: daysRemaining > 0 ? daysRemaining : undefined,
            };
          }
        }
      }
      return closestEvent;
    } catch (error) {
      console.error("Error fetching featured event from Supabase:", error);
      return null;
    }
  }

  /**
   * Get active announcements
   */
  async getActiveAnnouncements(): Promise<Announcement[]> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row: any) => ({
        id: row.firestore_id || row.id,
        title: row.title || "",
        message: row.message || "",
        link: row.link || "",
        isActive: row.is_active ?? true,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })) as Announcement[];
    } catch (error) {
      console.error("Error fetching announcements:", error);
      return [];
    }
  }

  /**
   * Get announcement2 from homepage settings
   */
  async getAnnouncement2(): Promise<string | null> {
    try {
      const homepage = await homepageService.getHomepage();
      return homepage.announcement2 || null;
    } catch (error) {
      console.error("Error fetching announcement2 from homepage:", error);
      return null;
    }
  }

  /**
   * Get complete dashboard data
   */
  async getDashboardData(): Promise<DailySpiritualDashboard> {
    const [
      templeStatus,
      featuredEvent,
      announcements,
      quote,
      announcement2,
    ] = await Promise.all([
      this.getTempleStatus(),
      this.getFeaturedEvent(),
      this.getActiveAnnouncements(),
      this.getDailyQuote(),
      this.getAnnouncement2(),
    ]);

    return {
      templeStatus,
      quote,
      featuredEvent,
      announcements,
      announcement2,
      lastUpdated: new Date().toISOString(),
    };
  }
}

export const dailySpiritualService = new DailySpiritualService();
