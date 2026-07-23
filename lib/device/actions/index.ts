/**
 * Device Actions Registry
 * Central registry for all device-based actions
 * Provides unified API for share, calendar, notifications, navigation, etc.
 */

import { useCallback, useMemo } from "react";
import { useDevice, useShare, useCalendar, useNotifications, useLocation } from "../hooks";
import { shareService } from "../share";
import type { CalendarEvent, ShareData } from "@/types/device";

// ============================================================================
// Action Types
// ============================================================================

export type ActionType =
  | "share"
  | "calendar"
  | "notify"
  | "navigate"
  | "copy"
  | "download"
  | "scan";

export interface DeviceAction {
  type: ActionType;
  label: string;
  icon: string;
  enabled: boolean;
  execute: () => void | Promise<void> | Promise<boolean>;
}

export interface DeviceActionContext {
  title: string;
  description?: string;
  url?: string;
  startDate?: Date;
  endDate?: Date;
  location?: string;
  phone?: string;
  email?: string;
  address?: string;
}

// ============================================================================
// Action Registry Hook
// ============================================================================

interface UseActionRegistryOptions {
  context?: DeviceActionContext;
}

interface UseActionRegistryReturn {
  // Available actions based on context
  availableActions: DeviceAction[];
  
  // Individual action executors
  share: (data?: Partial<ShareData>) => Promise<boolean>;
  copyText: (text: string) => Promise<boolean>;
  copyLink: () => Promise<boolean>;
  addToCalendar: (event?: Partial<CalendarEvent>) => void;
  downloadICS: (event?: Partial<CalendarEvent>) => void;
  scheduleReminder: (title: string, date: Date, minutesBefore?: number) => void;
  cancelReminder: (id: string) => void;
  navigate: (app?: "google" | "apple" | "waze") => void;
  openMaps: () => void;
  callPhone: (phone?: string) => void;
  sendEmail: (email?: string) => void;
  
  // Context helpers
  shareEvent: () => Promise<boolean>;
  sharePanchanga: () => Promise<boolean>;
  shareQuote: (quote: string, source?: string) => Promise<boolean>;
  shareDonation: () => Promise<boolean>;
  shareGalleryImage: (imageUrl: string) => Promise<boolean>;
}

export function useActionRegistry(options: UseActionRegistryOptions = {}): UseActionRegistryReturn {
  const { context } = options;
  const device = useDevice();
  const share = useShare();
  const calendar = useCalendar();
  const notifications = useNotifications();
  const location = useLocation();

  // Share action
  const shareAction = useCallback(async (data?: Partial<ShareData>): Promise<boolean> => {
    const shareData: ShareData = {
      title: data?.title ?? context?.title,
      text: data?.text ?? context?.description,
      url: data?.url ?? context?.url ?? (typeof window !== "undefined" ? window.location.href : ""),
      files: data?.files,
    };
    return share.share(shareData);
  }, [share, context]);

  // Copy text to clipboard
  const copyText = useCallback(async (text: string): Promise<boolean> => {
    const success = await share.copyToClipboard(text);
    return success;
  }, [share]);

  // Copy current page URL
  const copyLink = useCallback(async (): Promise<boolean> => {
    const url = context?.url ?? (typeof window !== "undefined" ? window.location.href : "");
    return share.copyToClipboard(url);
  }, [share, context]);

  // Add event to calendar
  const addToCalendar = useCallback((event?: Partial<CalendarEvent>) => {
    const calendarEvent: CalendarEvent = {
      title: event?.title ?? context?.title ?? "",
      description: event?.description ?? context?.description,
      location: event?.location ?? context?.location,
      startDate: event?.startDate ?? context?.startDate ?? new Date(),
      endDate: event?.endDate ?? context?.endDate ?? new Date(),
      allDay: event?.allDay ?? false,
      url: event?.url ?? context?.url,
    };
    calendar.addToGoogleCalendar(calendarEvent);
  }, [calendar, context]);

  // Download ICS file
  const downloadICS = useCallback((event?: Partial<CalendarEvent>) => {
    const calendarEvent: CalendarEvent = {
      title: event?.title ?? context?.title ?? "",
      description: event?.description ?? context?.description,
      location: event?.location ?? context?.location,
      startDate: event?.startDate ?? context?.startDate ?? new Date(),
      endDate: event?.endDate ?? context?.endDate ?? new Date(),
      allDay: event?.allDay ?? false,
      url: event?.url ?? context?.url,
    };
    calendar.downloadICS(calendarEvent);
  }, [calendar, context]);

  // Schedule notification reminder
  const scheduleReminder = useCallback((title: string, date: Date, minutesBefore = 30) => {
    const id = `reminder-${Date.now()}`;
    notifications.scheduleEventReminder(id, title, date, minutesBefore);
  }, [notifications]);

  // Cancel scheduled reminder
  const cancelReminder = useCallback((id: string) => {
    notifications.cancel(id);
  }, [notifications]);

  // Navigate to temple
  const navigate = useCallback((app?: "google" | "apple" | "waze") => {
    location.openNavigation(app);
  }, [location]);

  // Open maps
  const openMaps = useCallback(() => {
    location.openNavigation();
  }, [location]);

  // Call phone
  const callPhone = useCallback((phone?: string) => {
    const phoneNumber = phone ?? context?.phone ?? location.templeLocation.phone;
    if (phoneNumber) {
      window.location.href = `tel:${phoneNumber}`;
    }
  }, [context, location]);

  // Send email
  const sendEmail = useCallback((email?: string) => {
    const emailAddress = email ?? context?.email ?? "info@rayaramathaynk.com";
    window.location.href = `mailto:${emailAddress}`;
  }, [context]);

  // Contextual share helpers
  const shareEvent = useCallback(async (): Promise<boolean> => {
    return shareAction({
      title: context?.title,
      text: context?.description,
      url: context?.url,
    });
  }, [shareAction, context]);

  const sharePanchanga = useCallback(async (): Promise<boolean> => {
    const text = context?.description ?? "Today's Panchanga from Sri Raghavendra Swamy Matha";
    return shareAction({
      title: "Today's Panchanga",
      text,
      url: context?.url,
    });
  }, [shareAction, context]);

  const shareQuote = useCallback(async (quote: string, source?: string): Promise<boolean> => {
    return shareAction({
      title: "Daily Inspiration",
      text: `"${quote}"${source ? ` - ${source}` : " - Sri Raghavendra Swamy Matha"}`,
    });
  }, [shareAction]);

  const shareDonation = useCallback(async (): Promise<boolean> => {
    return shareAction({
      title: "Support Sri Raghavendra Swamy Matha",
      text: "Join me in supporting the divine services at Sri Raghavendra Swamy Matha",
      url: context?.url,
    });
  }, [shareAction, context]);

  const shareGalleryImage = useCallback(async (imageUrl: string): Promise<boolean> => {
    return shareAction({
      title: "Beautiful moments from Sri Raghavendra Swamy Matha",
      text: "Shared from Sri Raghavendra Swamy Matha",
      url: imageUrl,
    });
  }, [shareAction]);

  // Available actions based on context
  const availableActions = useMemo((): DeviceAction[] => {
    const actions: DeviceAction[] = [];

    if (context?.url || context?.title) {
      actions.push({
        type: "share",
        label: "Share",
        icon: "share",
        enabled: true,
        execute: () => shareAction(),
      });
    }

    if (context?.startDate) {
      actions.push({
        type: "calendar",
        label: "Add to Calendar",
        icon: "calendar",
        enabled: true,
        execute: () => addToCalendar(),
      });
    }

    actions.push({
      type: "navigate",
      label: "Get Directions",
      icon: "navigation",
      enabled: true,
      execute: () => navigate(),
    });

    if (context?.phone) {
      actions.push({
        type: "copy",
        label: "Call Temple",
        icon: "phone",
        enabled: true,
        execute: () => callPhone(),
      });
    }

    if (context?.url) {
      actions.push({
        type: "copy",
        label: "Copy Link",
        icon: "copy",
        enabled: true,
        execute: () => copyLink(),
      });
    }

    return actions;
  }, [context, shareAction, addToCalendar, navigate, callPhone, copyLink]);

  return {
    availableActions,
    share: shareAction,
    copyText,
    copyLink,
    addToCalendar,
    downloadICS,
    scheduleReminder,
    cancelReminder,
    navigate,
    openMaps,
    callPhone,
    sendEmail,
    shareEvent,
    sharePanchanga,
    shareQuote,
    shareDonation,
    shareGalleryImage,
  };
}

// ============================================================================
// Utility Functions (Non-Hook)
// ============================================================================

/**
 * Generate share text from template
 */
export function generateShareText(template: string, data: Record<string, string>): string {
  return shareService.generateShareText(template, data);
}

/**
 * Get available share providers
 */
export function getShareProviders() {
  return shareService.getAvailableProviders();
}

/**
 * Create calendar event object
 */
export function createCalendarEvent(data: {
  title: string;
  description?: string;
  location?: string;
  startDate: Date;
  endDate?: Date;
  allDay?: boolean;
  url?: string;
}): CalendarEvent {
  const endDate = data.endDate || new Date(data.startDate.getTime() + 60 * 60 * 1000);
  return {
    title: data.title,
    description: data.description,
    location: data.location,
    startDate: data.startDate,
    endDate,
    allDay: data.allDay ?? false,
    url: data.url,
  };
}
