/**
 * Device Analytics Service
 * Track anonymous usage events for device features
 * 
 * Note: This is a lightweight analytics implementation that stores events locally
 * and can be extended to send to an analytics backend.
 */

export type DeviceEventType =
  | "qr_scan"
  | "share"
  | "navigation_request"
  | "calendar_add"
  | "notification_subscribe"
  | "notification_open"
  | "device_action"
  | "permission_request";

export interface DeviceAnalyticsEvent {
  type: DeviceEventType;
  action: string;
  metadata?: Record<string, string | number | boolean>;
  timestamp?: number;
}

class DeviceAnalyticsService {
  private queue: DeviceAnalyticsEvent[] = [];
  private isProcessing = false;
  private readonly BATCH_SIZE = 10;
  private readonly PROCESS_INTERVAL = 5000; // 5 seconds

  constructor() {
    // Process queue periodically
    if (typeof window !== "undefined") {
      setInterval(() => this.processQueue(), this.PROCESS_INTERVAL);
    }
  }

  /**
   * Track a device feature event
   */
  track(event: DeviceAnalyticsEvent) {
    // Add timestamp if not provided
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }

    // Add to queue
    this.queue.push(event);

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.log("[Device Analytics]", event);
    }

    // Process immediately if queue is large
    if (this.queue.length >= this.BATCH_SIZE) {
      this.processQueue();
    }
  }

  /**
   * Track QR scan event
   */
  trackQRScan(result: string, format?: string) {
    this.track({
      type: "qr_scan",
      action: "scan",
      metadata: {
        resultLength: result.length,
        format: format || "unknown",
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Track share event
   */
  trackShare(contentType: string, provider?: string) {
    this.track({
      type: "share",
      action: "share",
      metadata: {
        contentType,
        provider: provider || "native",
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Track navigation request
   */
  trackNavigation(app?: "google" | "apple" | "waze") {
    this.track({
      type: "navigation_request",
      action: "navigate",
      metadata: {
        app: app || "default",
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Track calendar add event
   */
  trackCalendarAdd(provider: string, eventType: string) {
    this.track({
      type: "calendar_add",
      action: "add_to_calendar",
      metadata: {
        provider,
        eventType,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Track notification subscription
   */
  trackNotificationSubscribe(subscriptionType: string, enabled: boolean) {
    this.track({
      type: "notification_subscribe",
      action: enabled ? "subscribe" : "unsubscribe",
      metadata: {
        subscriptionType,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Track notification open
   */
  trackNotificationOpen(notificationId: string) {
    this.track({
      type: "notification_open",
      action: "open",
      metadata: {
        notificationId,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Track generic device action
   */
  trackDeviceAction(action: string, metadata?: Record<string, string | number | boolean>) {
    this.track({
      type: "device_action",
      action,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Track permission request
   */
  trackPermissionRequest(permissionType: string, granted: boolean) {
    this.track({
      type: "permission_request",
      action: granted ? "granted" : "denied",
      metadata: {
        permissionType,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Process queued events
   */
  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Get batch of events
      const batch = this.queue.splice(0, this.BATCH_SIZE);

      // In a real implementation, send to analytics backend here
      // For now, just log the events
      if (process.env.NODE_ENV === "development") {
        console.log("[Device Analytics] Processed batch:", batch.length, "events");
      }
    } catch (error) {
      // Put events back in queue if failed
      console.error("Failed to process device analytics:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Flush all pending events
   */
  async flush() {
    while (this.queue.length > 0) {
      await this.processQueue();
    }
  }

  /**
   * Get queued event count
   */
  getQueueCount(): number {
    return this.queue.length;
  }
}

// Singleton instance
export const deviceAnalytics = new DeviceAnalyticsService();

// Export for direct use
export const trackDeviceEvent = (
  type: DeviceEventType,
  action: string,
  metadata?: Record<string, string | number | boolean>
) => {
  deviceAnalytics.track({ type, action, metadata });
};
