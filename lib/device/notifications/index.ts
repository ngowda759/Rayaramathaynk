/**
 * Notifications Service
 * Browser notifications with scheduling support
 */

import type { NotificationOptions, ScheduledNotification, NotificationType } from "@/types/device";
import { isNotificationSupported } from "../capabilities";

class NotificationsService {
  private scheduledNotifications: Map<string, ScheduledNotification> = new Map();
  private permission: NotificationPermission = "default";

  constructor() {
    if (typeof window !== "undefined") {
      this.updatePermission();
    }
  }

  /**
   * Check if notifications are supported
   */
  isSupported(): boolean {
    return isNotificationSupported();
  }

  /**
   * Get current permission state
   */
  getPermission(): NotificationPermission {
    if (!this.isSupported()) return "denied";
    this.updatePermission();
    return this.permission;
  }

  /**
   * Update permission from Notification API
   */
  private updatePermission(): void {
    if (this.isSupported()) {
      this.permission = Notification.permission;
    }
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return "denied";
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission;
    } catch {
      return "denied";
    }
  }

  /**
   * Show a notification
   */
  show(options: NotificationOptions): Notification | null {
    if (!this.isSupported() || this.permission !== "granted") {
      return null;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon,
        badge: options.badge,
        tag: options.tag,
        data: options.data,
        requireInteraction: options.requireInteraction,
        silent: options.silent,
      });

      // Auto-close after 5 seconds if not requireInteraction
      if (!options.requireInteraction) {
        setTimeout(() => notification.close(), 5000);
      }

      return notification;
    } catch {
      return null;
    }
  }

  /**
   * Show a test notification
   */
  showTest(): Notification | null {
    return this.show({
      title: "Test Notification",
      body: "Notifications are working correctly!",
      icon: "/favicon.ico",
      tag: "test",
    });
  }

  /**
   * Schedule a notification for a future time
   */
  schedule(notification: ScheduledNotification): string {
    const now = Date.now();
    const scheduledTime = notification.scheduledTime.getTime();
    const delay = scheduledTime - now;

    if (delay < 0) {
      console.warn("Cannot schedule notification in the past");
      return notification.id;
    }

    // Store the notification
    this.scheduledNotifications.set(notification.id, notification);

    // Schedule the actual notification
    setTimeout(() => {
      this.show({
        title: notification.title,
        body: notification.body,
        icon: notification.icon,
        badge: notification.badge,
        tag: notification.tag,
        data: notification.data,
        requireInteraction: notification.requireInteraction,
      });
      this.cancel(notification.id);
    }, delay);

    return notification.id;
  }

  /**
   * Schedule a reminder for an event
   */
  scheduleEventReminder(
    eventId: string,
    eventTitle: string,
    eventDate: Date,
    minutesBefore: number = 30
  ): string {
    const reminderTime = new Date(eventDate.getTime() - minutesBefore * 60 * 1000);

    return this.schedule({
      id: `event-${eventId}`,
      title: "Event Reminder",
      body: `${eventTitle} starts in ${minutesBefore} minutes`,
      scheduledTime: reminderTime,
      type: "event",
      relatedId: eventId,
      requireInteraction: true,
    });
  }

  /**
   * Schedule a daily reminder (e.g., Panchanga)
   */
  scheduleDailyReminder(
    id: string,
    title: string,
    body: string,
    hour: number,
    minute: number
  ): string {
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(hour, minute, 0, 0);

    // If the time has passed today, schedule for tomorrow
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const notification: ScheduledNotification = {
      id: `daily-${id}`,
      title,
      body,
      scheduledTime,
      type: "reminder",
      requireInteraction: false,
    };

    // Store and schedule
    this.scheduledNotifications.set(notification.id, notification);

    // Calculate delay
    const delay = scheduledTime.getTime() - now.getTime();

    setTimeout(() => {
      this.show({
        title: notification.title,
        body: notification.body,
      });

      // Reschedule for next day
      this.scheduleDailyReminder(id, title, body, hour, minute);
    }, delay);

    return notification.id;
  }

  /**
   * Cancel a scheduled notification
   */
  cancel(id: string): void {
    this.scheduledNotifications.delete(id);
  }

  /**
   * Cancel all scheduled notifications
   */
  cancelAll(): void {
    this.scheduledNotifications.clear();
  }

  /**
   * Get all scheduled notifications
   */
  getScheduled(): ScheduledNotification[] {
    return Array.from(this.scheduledNotifications.values());
  }

  /**
   * Check if a notification is scheduled
   */
  isScheduled(id: string): boolean {
    return this.scheduledNotifications.has(id);
  }

  /**
   * Show notification for event type
   */
  showForType(type: NotificationType, data: Record<string, unknown>): Notification | null {
    switch (type) {
      case "event":
        return this.show({
          title: data.title as string || "Event Reminder",
          body: data.message as string || "An event is starting soon",
          tag: `event-${data.id}`,
        });

      case "seva":
        return this.show({
          title: "Seva Confirmation",
          body: `Your ${data.sevaName} has been booked for ${data.date}`,
          tag: `seva-${data.id}`,
        });

      case "festival":
        return this.show({
          title: "Festival Reminder",
          body: `${data.festivalName} is ${data.daysUntil} days away`,
          tag: `festival-${data.id}`,
          requireInteraction: true,
        });

      case "announcement":
        return this.show({
          title: data.title as string || "New Announcement",
          body: data.message as string,
          tag: `announcement-${data.id}`,
        });

      case "donation":
        return this.show({
          title: "Donation Receipt",
          body: `Thank you for your donation of ${data.amount}`,
          tag: `donation-${data.id}`,
        });

      default:
        return this.show({
          title: data.title as string || "Notification",
          body: data.message as string,
        });
    }
  }
}

// Singleton instance
export const notificationsService = new NotificationsService();
