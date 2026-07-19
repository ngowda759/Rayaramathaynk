/**
 * Daily Spiritual Dashboard Service
 * Epic 1: Fetches and combines all daily spiritual data for the homepage dashboard
 */

import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  getDoc,
} from "firebase/firestore";
import {
  TempleStatus,
  PanchangaSummary,
  PoojaInfo,
  PoojaSchedule,
  DailyQuote,
  PrasadaInfo,
  FeaturedEvent,
  DailySpiritualDashboard,
  DEFAULT_QUOTES,
  DEFAULT_PRASADA,
} from "@/types/daily-spiritual";
import type { DailyPooja } from "@/types/pooja";
import type { Announcement } from "@/types/announcement";
import { homepageService } from "./homepage.service";

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
 * Get current time in minutes from midnight
 */
function getCurrentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * Format date to YYYY-MM-DD string
 */
function formatDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Convert Firestore Timestamp to Date
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
    const now = new Date();
    const currentTime = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    let morningOpen = "06:00 AM";
    let morningClose = "12:00 PM";
    let eveningOpen = "05:00 PM";
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

    if (isTempleOpen) {
      if (currentMinutes >= morningOpenMinutes && currentMinutes < morningCloseMinutes) {
        session = "morning";
        message = "Morning Darshan in progress";
      } else if (currentMinutes >= eveningOpenMinutes && currentMinutes < eveningCloseMinutes) {
        session = "evening";
        message = "Evening Darshan in progress";
      } else if (currentMinutes < morningOpenMinutes) {
        nextOpenTime = morningOpen;
        message = `Opens at ${morningOpen}`;
      } else if (currentMinutes >= morningCloseMinutes && currentMinutes < eveningOpenMinutes) {
        nextOpenTime = eveningOpen;
        message = `Opens at ${eveningOpen}`;
      } else {
        message = "Temple closed for the day";
      }
    } else {
      message = "Temple is temporarily closed";
    }

    return {
      isOpen: session !== "closed",
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
   * Get today's panchanga summary
   */
  async getPanchangaSummary(): Promise<PanchangaSummary | null> {
    const today = formatDateString(new Date());

    try {
      if (!db) return null;
      const docRef = doc(db, "panchanga", today);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          tithi: data.tithi || "",
          nakshatra: data.nakshatra || "",
          yoga: data.yoga || "",
          karana: data.karana || "",
          sunrise: data.sunrise || "",
          sunset: data.sunset || "",
          rahuKalam: data.rahuKaal || data.rahuKalam || "",
          gulikaKalam: data.gulikaKalam || "",
          masa: data.masa || "",
          isFestival: data.isFestival || false,
          festivalName: data.festivalName,
          isEkadashi: data.isEkadashi || false,
          ekadashiName: data.ekadashiName,
        };
      }
    } catch (error) {
      console.error("Error fetching panchanga:", error);
    }

    return null;
  }

  /**
   * Get pooja schedule with current and next pooja
   */
  async getPoojaSchedule(): Promise<PoojaSchedule> {
    const emptySchedule: PoojaSchedule = {
      currentPooja: null,
      nextPooja: null,
      upcomingPoojas: [],
      countdown: null,
    };

    if (!db) return emptySchedule;

    try {
      const snapshot = await getDocs(
        query(
          collection(db, "dailyPoojas"),
          where("isActive", "==", true),
          orderBy("startTime", "asc")
        )
      );

      const poojas: DailyPooja[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as DailyPooja[];

      const currentMinutes = getCurrentMinutes();
      const poojaInfos: PoojaInfo[] = poojas.map((p) => {
        const startMinutes = parseTimeToMinutes(p.startTime);
        const durationMatch = p.duration?.match(/(\d+)/);
        const durationMinutes = durationMatch ? parseInt(durationMatch[1]) : 30;
        const endMinutes = startMinutes + durationMinutes;

        return {
          id: p.id,
          title: p.title,
          startTime: p.startTime,
          endTime: this.addMinutesToTime(p.startTime, durationMinutes),
          category: p.category || "Daily",
          isActive: p.isActive,
          isOngoing: currentMinutes >= startMinutes && currentMinutes < endMinutes,
        };
      });

      // Find current pooja
      const currentPooja = poojaInfos.find((p) => p.isOngoing) || null;

      // Find next pooja
      let nextPooja: PoojaInfo | null = null;
      for (const pooja of poojaInfos) {
        const poojaStartMinutes = parseTimeToMinutes(pooja.startTime);
        if (poojaStartMinutes > currentMinutes) {
          nextPooja = pooja;
          break;
        }
      }

      // Calculate countdown to next pooja
      let countdown: PoojaSchedule["countdown"] = null;
      if (nextPooja) {
        const nextMinutes = parseTimeToMinutes(nextPooja.startTime);
        const diffMinutes = nextMinutes - currentMinutes;
        countdown = {
          hours: Math.floor(diffMinutes / 60),
          minutes: diffMinutes % 60,
          seconds: 0,
          targetTime: nextPooja.startTime,
        };
      }

      // Get upcoming poojas (next 3)
      const upcomingPoojas = poojaInfos
        .filter((p) => parseTimeToMinutes(p.startTime) > currentMinutes)
        .slice(0, 3);

      return {
        currentPooja,
        nextPooja,
        upcomingPoojas,
        countdown,
      };
    } catch (error) {
      console.error("Error fetching pooja schedule:", error);
      return emptySchedule;
    }
  }

  /**
   * Add minutes to a time string
   */
  private addMinutesToTime(timeStr: string, minutes: number): string {
    const totalMinutes = parseTimeToMinutes(timeStr) + minutes;
    const hours = Math.floor(totalMinutes / 60) % 24;
    const mins = totalMinutes % 60;
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${mins.toString().padStart(2, "0")} ${period}`;
  }

  /**
   * Get daily quote (cycles through default quotes)
   */
  getDailyQuote(): DailyQuote {
    const today = new Date();
    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const index = dayOfYear % DEFAULT_QUOTES.length;
    return DEFAULT_QUOTES[index];
  }

  /**
   * Get prasada information
   */
  async getPrasadaInfo(): Promise<PrasadaInfo> {
    // Could be fetched from a settings collection or calculated based on time
    const templeStatus = await this.getTempleStatus();
    const currentMinutes = getCurrentMinutes();
    const morningCloseMinutes = parseTimeToMinutes(templeStatus.morningClose);

    return {
      ...DEFAULT_PRASADA,
      available: currentMinutes >= 360 && currentMinutes < morningCloseMinutes + 120,
      distributionTime:
        currentMinutes < morningCloseMinutes
          ? "Available now until evening"
          : "Available from next morning",
    };
  }

  /**
   * Get featured event for today
   */
  async getFeaturedEvent(): Promise<FeaturedEvent | null> {
    if (!db) return null;

    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    try {
      // First try to get featured events
      const featuredQuery = query(
        collection(db, "events"),
        where("featured", "==", true),
        where("published", "==", true)
      );
      const featuredSnap = await getDocs(featuredQuery);

      for (const docSnap of featuredSnap.docs) {
        const data = docSnap.data();
        const startDate = timestampToDate(data.startDate);
        const endDate = timestampToDate(data.endDate);

        if (endDate >= todayStart) {
          const isToday = startDate <= todayEnd && endDate >= todayStart;
          const daysRemaining = isToday
            ? 0
            : Math.ceil(
                (startDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24)
              );

          return {
            id: docSnap.id,
            title: data.title || "",
            description: data.description || "",
            startDate,
            endDate,
            startTime: data.startTime,
            endTime: data.endTime,
            category: data.category || "event",
            imageUrl: data.imageUrl,
            isToday,
            isOngoing: isToday,
            daysRemaining: daysRemaining > 0 ? daysRemaining : undefined,
          };
        }
      }

      // Fallback: check for events happening today
      const eventsQuery = query(
        collection(db, "events"),
        where("published", "==", true)
      );
      const eventsSnap = await getDocs(eventsQuery);

      let closestEvent: FeaturedEvent | null = null;
      let closestDaysRemaining = Infinity;

      for (const docSnap of eventsSnap.docs) {
        const data = docSnap.data();
        const startDate = timestampToDate(data.startDate);
        const endDate = timestampToDate(data.endDate);

        if (endDate >= todayStart) {
          const isToday = startDate <= todayEnd && endDate >= todayStart;
          const daysRemaining = isToday
            ? 0
            : Math.ceil(
                (startDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24)
              );

          if (daysRemaining < closestDaysRemaining) {
            closestDaysRemaining = daysRemaining;
            closestEvent = {
              id: docSnap.id,
              title: data.title || "",
              description: data.description || "",
              startDate,
              endDate,
              startTime: data.startTime,
              endTime: data.endTime,
              category: data.category || "event",
              imageUrl: data.imageUrl,
              isToday,
              isOngoing: isToday,
              daysRemaining: daysRemaining > 0 ? daysRemaining : undefined,
            };
          }
        }
      }

      return closestEvent;
    } catch (error) {
      console.error("Error fetching featured event:", error);
      return null;
    }
  }

  /**
   * Get active announcements
   */
  async getActiveAnnouncements(): Promise<Announcement[]> {
    if (!db) return [];

    try {
      const snapshot = await getDocs(
        query(
          collection(db, "announcements"),
          where("isActive", "==", true),
          orderBy("createdAt", "desc")
        )
      );
      return snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Announcement[];
    } catch (error) {
      console.error("Error fetching announcements:", error);
      return [];
    }
  }

  /**
   * Get complete dashboard data
   */
  async getDashboardData(): Promise<DailySpiritualDashboard> {
    const [
      templeStatus,
      panchanga,
      poojaSchedule,
      prasada,
      featuredEvent,
      announcements,
    ] = await Promise.all([
      this.getTempleStatus(),
      this.getPanchangaSummary(),
      this.getPoojaSchedule(),
      this.getPrasadaInfo(),
      this.getFeaturedEvent(),
      this.getActiveAnnouncements(),
    ]);

    return {
      templeStatus,
      panchanga,
      poojaSchedule,
      quote: this.getDailyQuote(),
      prasada,
      featuredEvent,
      announcements,
      lastUpdated: new Date().toISOString(),
    };
  }
}

export const dailySpiritualService = new DailySpiritualService();
