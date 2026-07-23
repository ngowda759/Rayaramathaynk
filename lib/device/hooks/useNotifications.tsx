"use client";

/**
 * useNotifications Hook
 * React hook for browser notifications
 */

import { useState, useEffect, useCallback } from "react";
import { notificationsService } from "../notifications";
import type { NotificationOptions, ScheduledNotification, NotificationType } from "@/types/device";
import { useNotificationPermission } from "./usePermissions";

interface UseNotificationsReturn {
  // State
  isSupported: boolean;
  permission: NotificationPermission;
  isGranted: boolean;
  isDenied: boolean;
  scheduledCount: number;
  
  // Actions
  requestPermission: () => Promise<NotificationPermission>;
  show: (options: NotificationOptions) => Notification | null;
  showTest: () => Notification | null;
  schedule: (notification: ScheduledNotification) => string;
  scheduleEventReminder: (eventId: string, title: string, date: Date, minutesBefore?: number) => string;
  scheduleDailyReminder: (id: string, title: string, body: string, hour: number, minute: number) => string;
  cancel: (id: string) => void;
  cancelAll: () => void;
  getScheduled: () => ScheduledNotification[];
  showForType: (type: NotificationType, data: Record<string, unknown>) => Notification | null;
}

export function useNotifications(): UseNotificationsReturn {
  const permissionHook = useNotificationPermission();
  const [scheduledCount, setScheduledCount] = useState(0);

  // Update scheduled count
  useEffect(() => {
    const updateCount = () => {
      setScheduledCount(notificationsService.getScheduled().length);
    };

    updateCount();
    const interval = setInterval(updateCount, 1000);

    return () => clearInterval(interval);
  }, []);

  const requestPermission = useCallback(async () => {
    return notificationsService.requestPermission();
  }, []);

  const show = useCallback((options: NotificationOptions) => {
    return notificationsService.show(options);
  }, []);

  const showTest = useCallback(() => {
    return notificationsService.showTest();
  }, []);

  const schedule = useCallback((notification: ScheduledNotification) => {
    const id = notificationsService.schedule(notification);
    setScheduledCount(notificationsService.getScheduled().length);
    return id;
  }, []);

  const scheduleEventReminder = useCallback((
    eventId: string,
    title: string,
    date: Date,
    minutesBefore: number = 30
  ) => {
    const id = notificationsService.scheduleEventReminder(eventId, title, date, minutesBefore);
    setScheduledCount(notificationsService.getScheduled().length);
    return id;
  }, []);

  const scheduleDailyReminder = useCallback((
    id: string,
    title: string,
    body: string,
    hour: number,
    minute: number
  ) => {
    const reminderId = notificationsService.scheduleDailyReminder(id, title, body, hour, minute);
    setScheduledCount(notificationsService.getScheduled().length);
    return reminderId;
  }, []);

  const cancel = useCallback((id: string) => {
    notificationsService.cancel(id);
    setScheduledCount(notificationsService.getScheduled().length);
  }, []);

  const cancelAll = useCallback(() => {
    notificationsService.cancelAll();
    setScheduledCount(0);
  }, []);

  const getScheduled = useCallback(() => {
    return notificationsService.getScheduled();
  }, []);

  const showForType = useCallback((type: NotificationType, data: Record<string, unknown>) => {
    return notificationsService.showForType(type, data);
  }, []);

  return {
    isSupported: notificationsService.isSupported(),
    permission: permissionHook.state === "granted" ? "granted" : 
                 permissionHook.state === "denied" ? "denied" : "default",
    isGranted: permissionHook.isGranted,
    isDenied: permissionHook.isDenied,
    scheduledCount,
    requestPermission,
    show,
    showTest,
    schedule,
    scheduleEventReminder,
    scheduleDailyReminder,
    cancel,
    cancelAll,
    getScheduled,
    showForType,
  };
}

/**
 * NotificationProvider Context
 */
import { createContext, useContext, ReactNode } from "react";

interface NotificationContextValue extends UseNotificationsReturn {
  permission: NotificationPermission;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const notifications = useNotifications();

  return (
    <NotificationContext.Provider value={notifications}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext(): NotificationContextValue | null {
  return useContext(NotificationContext);
}
