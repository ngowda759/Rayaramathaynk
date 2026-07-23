"use client";

/**
 * useCalendar Hook
 * React hook for calendar integration
 */

import { useCallback } from "react";
import { calendarService } from "../calendar";
import type { CalendarEvent, CalendarProvider } from "@/types/device";

interface UseCalendarReturn {
  // Actions
  addToGoogleCalendar: (event: CalendarEvent) => void;
  addToAppleCalendar: (event: CalendarEvent) => void;
  addToOutlook: (event: CalendarEvent) => void;
  downloadICS: (event: CalendarEvent) => void;
  addToCalendar: (provider: CalendarProvider, event: CalendarEvent) => void;
  getCalendarOptions: (event: CalendarEvent) => Array<{
    provider: CalendarProvider;
    label: string;
    icon: string;
    action: () => void;
  }>;
  
  // Utilities
  createEvent: (data: {
    title: string;
    description?: string;
    location?: string;
    startDate: Date;
    endDate?: Date;
    allDay?: boolean;
    url?: string;
  }) => CalendarEvent;
}

export function useCalendar(): UseCalendarReturn {
  const addToGoogleCalendar = useCallback((event: CalendarEvent) => {
    calendarService.addToCalendar("google", event);
  }, []);

  const addToAppleCalendar = useCallback((event: CalendarEvent) => {
    calendarService.addToCalendar("apple", event);
  }, []);

  const addToOutlook = useCallback((event: CalendarEvent) => {
    calendarService.addToCalendar("outlook", event);
  }, []);

  const downloadICS = useCallback((event: CalendarEvent) => {
    calendarService.downloadICS(event);
  }, []);

  const addToCalendar = useCallback((provider: CalendarProvider, event: CalendarEvent) => {
    calendarService.addToCalendar(provider, event);
  }, []);

  const getCalendarOptions = useCallback((event: CalendarEvent) => {
    return calendarService.getCalendarOptions(event);
  }, []);

  const createEvent = useCallback((data: {
    title: string;
    description?: string;
    location?: string;
    startDate: Date;
    endDate?: Date;
    allDay?: boolean;
    url?: string;
  }): CalendarEvent => {
    const endDate = data.endDate || new Date(data.startDate.getTime() + 60 * 60 * 1000); // Default 1 hour
    
    return {
      title: data.title,
      description: data.description,
      location: data.location,
      startDate: data.startDate,
      endDate,
      allDay: data.allDay || false,
      url: data.url,
    };
  }, []);

  return {
    addToGoogleCalendar,
    addToAppleCalendar,
    addToOutlook,
    downloadICS,
    addToCalendar,
    getCalendarOptions,
    createEvent,
  };
}

/**
 * useAddToCalendar Hook
 * Simplified hook for adding specific content to calendar
 */
interface UseAddToCalendarOptions {
  title: string;
  description?: string;
  location?: string;
  startDate: Date;
  endDate?: Date;
  allDay?: boolean;
  url?: string;
}

interface UseAddToCalendarReturn {
  // Event object
  event: CalendarEvent;
  
  // Individual provider actions
  addToGoogleCalendar: () => void;
  addToAppleCalendar: () => void;
  addToOutlook: () => void;
  downloadICS: () => void;
  
  // Options for UI
  calendarOptions: Array<{
    provider: CalendarProvider;
    label: string;
    icon: string;
    action: () => void;
  }>;
}

export function useAddToCalendar(options: UseAddToCalendarOptions): UseAddToCalendarReturn {
  const calendar = useCalendar();
  
  const event: CalendarEvent = {
    title: options.title,
    description: options.description,
    location: options.location,
    startDate: options.startDate,
    endDate: options.endDate || new Date(options.startDate.getTime() + 60 * 60 * 1000),
    allDay: options.allDay || false,
    url: options.url,
  };

  return {
    event,
    addToGoogleCalendar: () => calendar.addToGoogleCalendar(event),
    addToAppleCalendar: () => calendar.addToAppleCalendar(event),
    addToOutlook: () => calendar.addToOutlook(event),
    downloadICS: () => calendar.downloadICS(event),
    calendarOptions: calendar.getCalendarOptions(event),
  };
}
