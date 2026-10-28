/**
 * Page Views Service
 *
 * Tracks page views for the admin dashboard. `page_views` and `daily_page_stats` are
 * deny-all under RLS, so the browser posts a beacon to `/api/public/pageview` (the
 * server writes with the service role) and the admin dashboard reads the summary from
 * `/api/admin/web-analytics`. There is no Firestore path.
 */

export interface PageViewData {
  path: string;
  referrer?: string;
  deviceType?: "mobile" | "desktop" | "tablet";
  language?: string;
  country?: string;
}

export interface AnalyticsSummary {
  totalPageViews: number;
  uniqueVisitors: number;
  avgSessionDuration: string;
  bounceRate: string;
  topPages: Array<{ path: string; views: number }>;
  trafficSources: { direct: number; organic: number; referral: number; social: number };
  deviceBreakdown: { mobile: number; desktop: number; tablet: number };
  weeklyActiveUsers: number;
  newSignupsThisWeek: number;
}

const EMPTY_SUMMARY: AnalyticsSummary = {
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

/** Track a page view (fire-and-forget beacon; never throws). */
export async function trackPageView(data: PageViewData): Promise<void> {
  try {
    await fetch("/api/public/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        ...data,
        deviceType: data.deviceType || detectDeviceType(),
        language: data.language || "en",
        visitorId: getOrCreateVisitorId(),
      }),
    });
  } catch (error) {
    console.error("[PageViews] Failed to track page view:", error);
  }
}

/**
 * Get the analytics summary for the dashboard.
 *
 * `authToken` is the admin's Firebase ID token; the route requires it.
 */
export async function getAnalyticsSummary(
  days = 7,
  authToken?: string
): Promise<AnalyticsSummary> {
  try {
    const response = await fetch(`/api/admin/web-analytics?days=${days}`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });
    if (!response.ok) return EMPTY_SUMMARY;
    return (await response.json()) as AnalyticsSummary;
  } catch (error) {
    console.error("[PageViews] Failed to get analytics summary:", error);
    return EMPTY_SUMMARY;
  }
}

function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "server";
  let visitorId = localStorage.getItem("visitor_id");
  if (!visitorId) {
    visitorId = `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("visitor_id", visitorId);
  }
  return visitorId;
}

function detectDeviceType(): "mobile" | "desktop" | "tablet" {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) return "mobile";
  return "desktop";
}
