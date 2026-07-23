/**
 * AI Action Registry
 * Handles execution of AI-initiated actions
 */

import { Intent } from "@/lib/ai/intent/types";

export type ActionType =
  | "navigate"
  | "share"
  | "calendar"
  | "notification"
  | "open_gallery"
  | "open_library"
  | "open_event"
  | "open_live"
  | "open_contact"
  | "open_qr_scanner"
  | "book_seva"
  | "make_donation"
  | "play_audio"
  | "show_panchanga";

export interface AIAction {
  type: ActionType;
  params: Record<string, unknown>;
  description: string;
  icon?: string;
}

export interface ActionResult {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}

type ActionHandler = (params: Record<string, unknown>) => Promise<ActionResult>;

// Action handlers registry
const actionHandlers: Map<ActionType, ActionHandler> = new Map();

/**
 * Register an action handler
 */
export function registerAction(type: ActionType, handler: ActionHandler) {
  actionHandlers.set(type, handler);
}

/**
 * Execute an action
 */
export async function executeAction(action: AIAction): Promise<ActionResult> {
  const handler = actionHandlers.get(action.type);
  
  if (!handler) {
    return {
      success: false,
      error: `Unknown action type: ${action.type}`,
    };
  }

  try {
    return await handler(action.params);
  } catch (error) {
    console.error(`[AIActions] Error executing action ${action.type}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Action execution failed",
    };
  }
}

// Default action handlers

// Navigate action
registerAction("navigate", async (params) => {
  const { url, page } = params;
  const targetUrl = url as string || getPageUrl(page as string);
  
  if (typeof window !== "undefined") {
    window.location.href = targetUrl;
  }
  
  return {
    success: true,
    message: `Navigating to ${targetUrl}`,
  };
});

function getPageUrl(page: string): string {
  const pages: Record<string, string> = {
    home: "/",
    gallery: "/gallery",
    events: "/events",
    donate: "/donation",
    sevas: "/sevas",
    aaradhane: "/aaradhane",
    calendar: "/calendar",
    quotes: "/quotes",
    stotras: "/stotras",
    live: "/live",
    knowledge: "/knowledge",
    timeline: "/timeline",
    profile: "/profile",
    notifications: "/notifications",
  };
  
  return pages[page.toLowerCase()] || "/";
}

// Share action
registerAction("share", async (params) => {
  const { title, text, url } = params;
  
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: title as string || "Sri Raghavendra Swamy Temple",
        text: text as string,
        url: url as string || window.location.href,
      });
      return { success: true, message: "Shared successfully" };
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return { success: false, message: "Share cancelled" };
      }
      throw error;
    }
  }
  
  // Fallback to clipboard
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    const shareText = `${title || ""}\n${text || ""}\n${url || window.location.href}`;
    await navigator.clipboard.writeText(shareText);
    return { success: true, message: "Link copied to clipboard" };
  }
  
  return { success: false, error: "Sharing not supported" };
});

// Calendar action
registerAction("calendar", async (params) => {
  const { event, date, action } = params;
  
  if (action === "add" && date) {
    // Create calendar event
    const eventDate = new Date(date as string);
    const startDate = eventDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const endDate = new Date(eventDate.getTime() + 60 * 60 * 1000).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event as string || "Temple Event")}&dates=${startDate}/${endDate}`;
    
    if (typeof window !== "undefined") {
      window.open(calendarUrl, "_blank");
    }
    
    return { success: true, message: "Opening calendar to add event" };
  }
  
  return { success: true, data: { event, date } };
});

// Notification action
registerAction("notification", async (params) => {
  const { type, enabled, subscribe } = params;
  
  if (subscribe !== undefined) {
    // Request notification permission
    if (typeof Notification !== "undefined") {
      const permission = await Notification.requestPermission();
      
      if (permission === "granted") {
        // Subscribe to notifications
        if (typeof window !== "undefined" && "serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.ready;
          // Subscribe to push notifications
          // This would integrate with the Device Platform
        }
        return { success: true, message: "Notifications enabled" };
      }
      
      return { success: false, error: "Notification permission denied" };
    }
  }
  
  return { success: true, data: { type, enabled } };
});

// Open Gallery action
registerAction("open_gallery", async (params) => {
  const { category, album } = params;
  let url = "/gallery";
  
  if (category) {
    url += `?category=${encodeURIComponent(category as string)}`;
  }
  if (album) {
    url += `${category ? "&" : "?"}album=${encodeURIComponent(album as string)}`;
  }
  
  if (typeof window !== "undefined") {
    window.location.href = url;
  }
  
  return { success: true, message: `Opening gallery${category ? ` (${category})` : ""}` };
});

// Open Library action
registerAction("open_library", async (params) => {
  const { category, search } = params;
  let url = "/library";
  
  if (category) {
    url += `?category=${encodeURIComponent(category as string)}`;
  }
  if (search) {
    url += `${category ? "&" : "?"}q=${encodeURIComponent(search as string)}`;
  }
  
  if (typeof window !== "undefined") {
    window.location.href = url;
  }
  
  return { success: true, message: `Opening library${category ? ` (${category})` : ""}` };
});

// Open Event action
registerAction("open_event", async (params) => {
  const { eventId, eventName } = params;
  
  if (eventId) {
    if (typeof window !== "undefined") {
      window.location.href = `/events/${eventId}`;
    }
    return { success: true, message: `Opening event: ${eventName || eventId}` };
  }
  
  if (typeof window !== "undefined") {
    window.location.href = "/events";
  }
  
  return { success: true, message: "Opening events" };
});

// Open Live Stream action
registerAction("open_live", async (params) => {
  if (typeof window !== "undefined") {
    window.location.href = "/live";
  }
  
  return { success: true, message: "Opening live darshan" };
});

// Open Contact action
registerAction("open_contact", async (params) => {
  if (typeof window !== "undefined") {
    window.location.href = "/contact";
  }
  
  return { success: true, message: "Opening contact page" };
});

// Open QR Scanner action
registerAction("open_qr_scanner", async (params) => {
  // QR scanner would require camera access
  if (typeof window !== "undefined") {
    // This would open a QR scanner modal or page
    window.location.href = "/qr-scanner";
  }
  
  return { success: true, message: "Opening QR scanner" };
});

// Book Seva action
registerAction("book_seva", async (params) => {
  const { sevaType } = params;
  let url = "/sevas";
  
  if (sevaType) {
    url += `?type=${encodeURIComponent(sevaType as string)}`;
  }
  
  if (typeof window !== "undefined") {
    window.location.href = url;
  }
  
  return { success: true, message: `Opening ${sevaType || "seva"} booking` };
});

// Make Donation action
registerAction("make_donation", async (params) => {
  const { cause, amount } = params;
  let url = "/donation";
  
  if (cause || amount) {
    url += "?";
    if (cause) url += `cause=${encodeURIComponent(cause as string)}`;
    if (amount) url += `${cause ? "&" : ""}amount=${encodeURIComponent(amount as string)}`;
  }
  
  if (typeof window !== "undefined") {
    window.location.href = url;
  }
  
  return { success: true, message: "Opening donation page" };
});

// Play Audio action
registerAction("play_audio", async (params) => {
  const { stotraId, audioUrl } = params;
  
  if (audioUrl) {
    // This would integrate with an audio player
    return { success: true, data: { audioUrl, stotraId } };
  }
  
  if (stotraId) {
    return { success: true, data: { stotraId } };
  }
  
  return { success: false, error: "No audio specified" };
});

// Show Panchanga action
registerAction("show_panchanga", async (params) => {
  const { date } = params;
  let url = "/calendar";
  
  if (date) {
    url += `?date=${encodeURIComponent(date as string)}`;
  }
  
  if (typeof window !== "undefined") {
    window.location.href = url;
  }
  
  return { success: true, message: "Showing panchanga" };
});

/**
 * Map intents to actions
 * This enables the AI to execute actions based on detected intents
 */
export function getActionsForIntent(intent: Intent): AIAction[] {
  const intentActions: Partial<Record<Intent, AIAction[]>> = {
    [Intent.GENERAL_GREETING]: [],
    [Intent.GOODBYE]: [],
    [Intent.THANKS]: [],
    [Intent.TEMPLE_TIMINGS]: [
      { type: "navigate", params: { page: "calendar" }, description: "Show temple timings" },
    ],
    [Intent.NEXT_AARADHANE]: [
      { type: "navigate", params: { page: "aaradhane" }, description: "Open Aaradhane" },
    ],
    [Intent.UPCOMING_EVENTS]: [
      { type: "navigate", params: { page: "events" }, description: "Show events" },
    ],
    [Intent.FESTIVAL_INFO]: [
      { type: "navigate", params: { page: "calendar" }, description: "Show festivals" },
    ],
    [Intent.PANCHANGA]: [
      { type: "show_panchanga", params: {}, description: "Show today's panchanga" },
    ],
    [Intent.GALLERY]: [
      { type: "open_gallery", params: {}, description: "Open gallery" },
    ],
    [Intent.DONATION]: [
      { type: "make_donation", params: {}, description: "Make a donation" },
    ],
    [Intent.CONTACT_REQUEST]: [
      { type: "open_contact", params: {}, description: "Contact temple" },
    ],
    [Intent.SEVA_BOOKING]: [
      { type: "book_seva", params: {}, description: "Book a seva" },
    ],
    [Intent.DAILY_QUOTE]: [
      { type: "navigate", params: { page: "quotes" }, description: "Show daily quote" },
    ],
    [Intent.SHARE_EXPERIENCE]: [
      { type: "share", params: {}, description: "Share content" },
    ],
    [Intent.OUT_OF_SCOPE]: [],
    [Intent.UNKNOWN]: [],
  };

  return intentActions[intent] || [];
}

/**
 * Parse action from AI response
 * Extracts action commands from the generated text
 */
export function parseActionsFromResponse(response: string): AIAction[] {
  const actions: AIAction[] = [];
  
  // Look for action patterns like [action:navigate:page=home]
  const actionPattern = /\[action:(\w+)(?::([^=\]]+))?(?:=([^\]]+))?\]/g;
  let match;
  
  while ((match = actionPattern.exec(response)) !== null) {
    const [, type, subType, value] = match;
    
    if (type === "navigate" && subType) {
      actions.push({
        type: "navigate",
        params: { page: subType },
        description: `Navigate to ${subType}`,
      });
    } else if (type === "share") {
      actions.push({
        type: "share",
        params: {},
        description: "Share content",
      });
    } else if (type === "open") {
      actions.push({
        type: `open_${subType}` as ActionType,
        params: {},
        description: `Open ${subType}`,
      });
    }
  }
  
  return actions;
}
