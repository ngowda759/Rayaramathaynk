/**
 * Device Action Registry
 * Central registry for device-related actions that can be triggered by Raya AI
 * Provides a clean interface for AI assistants to invoke device capabilities
 */

import type { ShareData, CalendarEvent, TempleLocation } from "@/types/device";

export type DeviceActionType =
  | "navigate_to_temple"
  | "open_qr_scanner"
  | "share_panchanga"
  | "share_event"
  | "share_seva"
  | "share_quote"
  | "share_gallery"
  | "add_to_calendar"
  | "notify_event"
  | "notify_seva"
  | "share_daily_panchanga"
  | "share_temple_details"
  | "get_directions"
  | "share_today_quote";

export interface DeviceAction {
  type: DeviceActionType;
  label: string;
  description: string;
  icon?: string;
  params?: Record<string, unknown>;
}

export interface DeviceActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

type ActionHandler = (params?: Record<string, unknown>) => Promise<DeviceActionResult>;

class DeviceActionRegistry {
  private actions: Map<DeviceActionType, ActionHandler> = new Map();
  private actionDefinitions: Map<DeviceActionType, Omit<DeviceAction, "params">> = new Map();

  constructor() {
    this.registerDefaultActions();
  }

  /**
   * Register a custom action handler
   */
  register(type: DeviceActionType, handler: ActionHandler, definition: Omit<DeviceAction, "params">): void {
    this.actions.set(type, handler);
    this.actionDefinitions.set(type, definition);
  }

  /**
   * Execute an action
   */
  async execute(type: DeviceActionType, params?: Record<string, unknown>): Promise<DeviceActionResult> {
    const handler = this.actions.get(type);

    if (!handler) {
      return {
        success: false,
        message: `Action '${type}' is not registered`,
      };
    }

    try {
      return await handler(params);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Action execution failed",
      };
    }
  }

  /**
   * Get all available actions
   */
  getAvailableActions(): DeviceAction[] {
    return Array.from(this.actionDefinitions.values()).map((def) => ({
      ...def,
      params: {},
    }));
  }

  /**
   * Get action definition
   */
  getActionDefinition(type: DeviceActionType): DeviceAction | undefined {
    const def = this.actionDefinitions.get(type);
    return def ? { ...def, params: {} } : undefined;
  }

  /**
   * Check if action is available
   */
  isAvailable(type: DeviceActionType): boolean {
    return this.actions.has(type);
  }

  /**
   * Register default device actions
   */
  private registerDefaultActions(): void {
    // Navigate to Temple
    this.register("navigate_to_temple", async () => {
      const { locationService } = await import("./location");
      locationService.openNavigation();
      return {
        success: true,
        message: "Opening navigation to temple",
      };
    }, {
      type: "navigate_to_temple",
      label: "Navigate to Temple",
      description: "Open navigation to the temple location",
      icon: "navigation",
    });

    // Open QR Scanner
    this.register("open_qr_scanner", async () => {
      // This will be handled by UI - just return success
      // The UI should listen for this action type
      return {
        success: true,
        message: "QR Scanner opened",
        data: { action: "open_qr_scanner" },
      };
    }, {
      type: "open_qr_scanner",
      label: "Open QR Scanner",
      description: "Open the camera to scan QR codes",
      icon: "qr-code",
    });

    // Share Panchanga
    this.register("share_panchanga", async (params) => {
      const { shareService } = await import("./share");
      const { deviceSettingsService } = await import("./settings");
      
      const templates = deviceSettingsService.getShareTemplates();
      const text = templates.panchanga
        .replace("{date}", params?.date as string || new Date().toLocaleDateString())
        .replace("{summary}", params?.summary as string || "");

      shareService.share({
        title: "Today's Panchanga - Sri Raghavendra Swamy Matha",
        text,
        url: params?.url as string || "",
      });

      return {
        success: true,
        message: "Panchanga shared successfully",
      };
    }, {
      type: "share_panchanga",
      label: "Share Today's Panchanga",
      description: "Share today's Panchanga with others",
      icon: "share",
    });

    // Share Event
    this.register("share_event", async (params) => {
      const { shareService } = await import("./share");
      
      shareService.share({
        title: params?.title as string || "Temple Event",
        text: params?.text as string || "",
        url: params?.url as string || "",
      });

      return {
        success: true,
        message: "Event shared successfully",
      };
    }, {
      type: "share_event",
      label: "Share Event",
      description: "Share an event with others",
      icon: "share",
    });

    // Add to Calendar
    this.register("add_to_calendar", async (params) => {
      const { calendarService } = await import("./calendar");
      
      const startDate = new Date(params?.startDate as string || Date.now());
      const endDate = params?.endDate 
        ? new Date(params?.endDate as string) 
        : new Date(startDate.getTime() + 60 * 60 * 1000); // Default 1 hour
      
      const event: CalendarEvent = {
        title: params?.title as string || "Temple Event",
        description: params?.description as string,
        location: params?.location as string,
        startDate,
        endDate,
        allDay: params?.allDay as boolean || false,
        url: params?.url as string,
      };

      calendarService.addToCalendar("google", event);

      return {
        success: true,
        message: `Added '${event.title}' to Google Calendar`,
      };
    }, {
      type: "add_to_calendar",
      label: "Add to Calendar",
      description: "Add an event to your calendar",
      icon: "calendar",
    });

    // Notify for Event
    this.register("notify_event", async (params) => {
      const { notificationsService } = await import("./notifications");
      
      const eventId = params?.eventId as string || "event";
      const title = params?.title as string || "Temple Event";
      const date = new Date(params?.date as string || Date.now());
      const minutesBefore = params?.minutesBefore as number || 30;

      const notificationId = notificationsService.scheduleEventReminder(
        eventId,
        title,
        date,
        minutesBefore
      );

      return {
        success: true,
        message: `You'll be notified ${minutesBefore} minutes before '${title}'`,
        data: { notificationId },
      };
    }, {
      type: "notify_event",
      label: "Set Event Reminder",
      description: "Get notified before an event starts",
      icon: "bell",
    });

    // Share Today's Quote
    this.register("share_today_quote", async (params) => {
      const { shareService } = await import("./share");
      const { deviceSettingsService } = await import("./settings");
      
      const templates = deviceSettingsService.getShareTemplates();
      const text = templates.quote
        .replace("{quote}", params?.quote as string || "");

      shareService.share({
        title: "Daily Quote - Sri Raghavendra Swamy Matha",
        text,
        url: params?.url as string || "",
      });

      return {
        success: true,
        message: "Quote shared successfully",
      };
    }, {
      type: "share_today_quote",
      label: "Share Today's Quote",
      description: "Share today's spiritual quote with others",
      icon: "share",
    });

    // Share Temple Details
    this.register("share_temple_details", async () => {
      const { shareService } = await import("./share");
      const { locationService } = await import("./location");
      
      const templeLocation = locationService.getTempleLocation();
      const url = locationService.getLocationUrl();

      shareService.share({
        title: "Sri Raghavendra Swamy Matha - Yelahanka",
        text: `${templeLocation.name}\n${templeLocation.address}\n\nVisit us for divine blessings!`,
        url,
      });

      return {
        success: true,
        message: "Temple details shared successfully",
      };
    }, {
      type: "share_temple_details",
      label: "Share Temple Details",
      description: "Share temple location and contact information",
      icon: "share",
    });

    // Get Directions
    this.register("get_directions", async () => {
      const { locationService } = await import("./location");
      const app = (await import("./settings")).deviceSettingsService.getDefaultNavigationApp();
      
      locationService.openNavigation(app);

      return {
        success: true,
        message: `Opening ${app} Maps with directions`,
      };
    }, {
      type: "get_directions",
      label: "Get Directions",
      description: "Get directions to the temple",
      icon: "navigation",
    });

    // Share Seva
    this.register("share_seva", async (params) => {
      const { shareService } = await import("./share");
      const { deviceSettingsService } = await import("./settings");
      
      const templates = deviceSettingsService.getShareTemplates();
      const text = templates.seva
        .replace("{sevaName}", params?.sevaName as string || "")
        .replace("{date}", params?.date as string || "");

      shareService.share({
        title: `Booked: ${params?.sevaName} - Sri Raghavendra Swamy Matha`,
        text,
        url: params?.url as string || "",
      });

      return {
        success: true,
        message: "Seva booking shared successfully",
      };
    }, {
      type: "share_seva",
      label: "Share Seva Booking",
      description: "Share your seva booking confirmation",
      icon: "share",
    });

    // Share Gallery Image
    this.register("share_gallery", async (params) => {
      const { shareService } = await import("./share");
      
      shareService.share({
        title: "Sri Raghavendra Swamy Matha",
        text: "Beautiful moments from the temple",
        url: params?.imageUrl as string || "",
      });

      return {
        success: true,
        message: "Gallery image shared successfully",
      };
    }, {
      type: "share_gallery",
      label: "Share Gallery Image",
      description: "Share a gallery image with others",
      icon: "image",
    });
  }
}

// Singleton instance
export const deviceActionRegistry = new DeviceActionRegistry();

/**
 * Hook for using device actions in components
 */
import { useState, useCallback, useEffect } from "react";

interface UseDeviceActionsReturn {
  executeAction: (type: DeviceActionType, params?: Record<string, unknown>) => Promise<DeviceActionResult>;
  availableActions: DeviceAction[];
  lastResult: DeviceActionResult | null;
  isExecuting: boolean;
}

export function useDeviceActions(): UseDeviceActionsReturn {
  const [lastResult, setLastResult] = useState<DeviceActionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const executeAction = useCallback(async (
    type: DeviceActionType,
    params?: Record<string, unknown>
  ): Promise<DeviceActionResult> => {
    setIsExecuting(true);
    try {
      const result = await deviceActionRegistry.execute(type, params);
      setLastResult(result);
      return result;
    } finally {
      setIsExecuting(false);
    }
  }, []);

  const availableActions = deviceActionRegistry.getAvailableActions();

  return {
    executeAction,
    availableActions,
    lastResult,
    isExecuting,
  };
}
