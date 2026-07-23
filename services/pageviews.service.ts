/**
 * Page Views Service
 * Tracks page views and stores aggregated data in Firestore for admin dashboard
 */

import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, increment, doc, updateDoc, setDoc, getDocs, query, where, orderBy, limit, Timestamp } from "firebase/firestore";

const PAGE_VIEWS_COLLECTION = "page_views";
const DAILY_STATS_COLLECTION = "daily_page_stats";
const SESSIONS_COLLECTION = "sessions";

export interface PageViewData {
  path: string;
  referrer?: string;
  deviceType?: "mobile" | "desktop" | "tablet";
  language?: string;
  country?: string;
}

export interface DailyStats {
  date: string;
  pageViews: number;
  uniqueVisitors: number;
  topPages: Array<{ path: string; views: number }>;
  trafficSources: { direct: number; organic: number; referral: number; social: number };
  deviceBreakdown: { mobile: number; desktop: number; tablet: number };
  avgSessionDuration: number;
  bounceRate: number;
}

/**
 * Track a page view
 */
export async function trackPageView(data: PageViewData): Promise<void> {
  if (!db || !isFirebaseConfigured) {
    console.warn("[PageViews] Firestore not configured, skipping tracking");
    return;
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const visitorId = getOrCreateVisitorId();
    
    // Log individual page view
    await addDoc(collection(db, PAGE_VIEWS_COLLECTION), {
      path: data.path,
      referrer: data.referrer || "direct",
      deviceType: data.deviceType || detectDeviceType(),
      language: data.language || "en",
      country: data.country || "unknown",
      visitorId,
      timestamp: serverTimestamp(),
      date: today,
    });

    // Update daily stats atomically
    const dailyStatsRef = doc(db, DAILY_STATS_COLLECTION, today);
    const sourceField = `trafficSources.${getTrafficSource(data.referrer)}`;
    const deviceField = `deviceBreakdown.${data.deviceType || "desktop"}`;

    await setDoc(dailyStatsRef, {
      date: today,
      pageViews: increment(1),
      lastUpdated: serverTimestamp(),
    }, { merge: true });

    // Update top pages
    const topPagesRef = doc(db, DAILY_STATS_COLLECTION, `${today}_pages`);
    await setDoc(topPagesRef, {
      [`pages.${data.path}`]: increment(1),
    }, { merge: true });

  } catch (error) {
    console.error("[PageViews] Failed to track page view:", error);
  }
}

/**
 * Get analytics summary for the dashboard
 */
export async function getAnalyticsSummary(days = 7): Promise<{
  totalPageViews: number;
  uniqueVisitors: number;
  avgSessionDuration: string;
  bounceRate: string;
  topPages: Array<{ path: string; views: number }>;
  trafficSources: { direct: number; organic: number; referral: number; social: number };
  deviceBreakdown: { mobile: number; desktop: number; tablet: number };
  weeklyActiveUsers: number;
  newSignupsThisWeek: number;
}> {
  if (!db || !isFirebaseConfigured) {
    return {
      totalPageViews: 0,
      uniqueVisitors: 0,
      avgSessionDuration: "0m",
      bounceRate: "0%",
      topPages: [],
      trafficSources: { direct: 0, organic: 0, referral: 0, social: 0 },
      deviceBreakdown: { mobile: 0, desktop: 0, tablet: 0 },
      weeklyActiveUsers: 0,
      newSignupsThisWeek: 0,
    };
  }

  try {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const weekAgo = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Get all page views from the last N days
    const pageViewsQuery = query(
      collection(db, PAGE_VIEWS_COLLECTION),
      orderBy("timestamp", "desc"),
      limit(10000)
    );
    
    const pageViewsSnap = await getDocs(pageViewsQuery);
    const pageViews = pageViewsSnap.docs.map(doc => doc.data());

    // Calculate totals
    const totalPageViews = pageViews.length;
    
    // Count unique visitors
    const visitorIds = new Set<string>();
    pageViews.forEach(pv => {
      if (pv.visitorId) visitorIds.add(pv.visitorId);
    });
    const uniqueVisitors = visitorIds.size;

    // Aggregate top pages
    const pageViewMap: Record<string, number> = {};
    pageViews.forEach(pv => {
      const path = pv.path || "/";
      pageViewMap[path] = (pageViewMap[path] || 0) + 1;
    });
    const topPages = Object.entries(pageViewMap)
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    // Aggregate traffic sources
    const sourcesMap: Record<string, number> = { direct: 0, organic: 0, referral: 0, social: 0 };
    pageViews.forEach(pv => {
      const source = pv.referrer || "direct";
      const normalizedSource = getTrafficSource(source);
      sourcesMap[normalizedSource] = (sourcesMap[normalizedSource] || 0) + 1;
    });

    // Aggregate device breakdown
    const devicesMap: Record<string, number> = { mobile: 0, desktop: 0, tablet: 0 };
    pageViews.forEach(pv => {
      const device = pv.deviceType || "desktop";
      devicesMap[device] = (devicesMap[device] || 0) + 1;
    });

    const totalDevices = devicesMap.mobile + devicesMap.desktop + devicesMap.tablet;
    const deviceBreakdown = {
      mobile: totalDevices > 0 ? Math.round((devicesMap.mobile / totalDevices) * 100) : 0,
      desktop: totalDevices > 0 ? Math.round((devicesMap.desktop / totalDevices) * 100) : 0,
      tablet: totalDevices > 0 ? Math.round((devicesMap.tablet / totalDevices) * 100) : 0,
    };

    // Estimate session duration and bounce rate based on page views per visitor
    const viewsPerVisitor = uniqueVisitors > 0 ? totalPageViews / uniqueVisitors : 1;
    const estimatedBounceRate = Math.max(0, Math.min(100, Math.round((1 - (viewsPerVisitor - 1) / 3) * 100)));
    const estimatedSessionDuration = viewsPerVisitor > 1 ? `${Math.round(viewsPerVisitor * 1.5)}m` : `${Math.round(viewsPerVisitor * 2)}m`;

    return {
      totalPageViews,
      uniqueVisitors,
      avgSessionDuration: estimatedSessionDuration,
      bounceRate: `${estimatedBounceRate}%`,
      topPages,
      trafficSources: {
        direct: sourcesMap.direct,
        organic: sourcesMap.organic,
        referral: sourcesMap.referral,
        social: sourcesMap.social,
      },
      deviceBreakdown,
      weeklyActiveUsers: uniqueVisitors,
      newSignupsThisWeek: 0,
    };
  } catch (error) {
    console.error("[PageViews] Failed to get analytics summary:", error);
    return {
      totalPageViews: 0,
      uniqueVisitors: 0,
      avgSessionDuration: "0m",
      bounceRate: "0%",
      topPages: [],
      trafficSources: { direct: 0, organic: 0, referral: 0, social: 0 },
      deviceBreakdown: { mobile: 0, desktop: 0, tablet: 0 },
      weeklyActiveUsers: 0,
      newSignupsThisWeek: 0,
    };
  }
}

/**
 * Get visitor ID from localStorage or generate a new one
 */
function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "server";
  
  let visitorId = localStorage.getItem("visitor_id");
  if (!visitorId) {
    visitorId = `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("visitor_id", visitorId);
  }
  return visitorId;
}

/**
 * Detect device type from user agent
 */
function detectDeviceType(): "mobile" | "desktop" | "tablet" {
  if (typeof window === "undefined") return "desktop";
  
  const ua = navigator.userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return "tablet";
  }
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

/**
 * Normalize traffic source
 */
function getTrafficSource(referrer: string | undefined): string {
  if (!referrer || referrer === "direct") return "direct";
  
  const ref = referrer.toLowerCase();
  
  // Social networks
  if (ref.includes("facebook") || ref.includes("twitter") || ref.includes("instagram") || 
      ref.includes("linkedin") || ref.includes("youtube") || ref.includes("whatsapp")) {
    return "social";
  }
  
  // Search engines
  if (ref.includes("google") || ref.includes("bing") || ref.includes("yahoo") || 
      ref.includes("duckduckgo") || ref.includes("baidu")) {
    return "organic";
  }
  
  // Everything else is referral
  return "referral";
}
