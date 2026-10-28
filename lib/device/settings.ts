/**
 * Device Settings Service
 * Centralized settings management for device features
 * Settings come from Supabase `settings_documents` (document_key "device").
 */

import type { DeviceSettings, TempleLocation, CalendarProvider, CameraDirection } from "@/types/device";
import { DEFAULT_DEVICE_SETTINGS } from "@/types/device";

type SettingsListener = (settings: DeviceSettings) => void;

class DeviceSettingsService {
  private settings: DeviceSettings;
  private listeners: Set<SettingsListener> = new Set();
  private initialized: boolean = false;

  constructor() {
    this.settings = { ...DEFAULT_DEVICE_SETTINGS };
  }

  /**
   * Get current settings
   */
  get(): DeviceSettings {
    return { ...this.settings };
  }

  /**
   * Get specific setting value
   */
  getValue<K extends keyof DeviceSettings>(key: K): DeviceSettings[K] {
    return this.settings[key];
  }

  /**
   * Initialize settings from Firestore (admin)
   * Called by admin app on load
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Settings are stored in Supabase `settings_documents` (document_key "device").
      // The document is deny-all under RLS, so the browser reads it through the
      // server-side public settings route. There is no Firestore path.
      const response = await fetch("/api/public/settings/device");
      if (response.ok) {
        const { data } = (await response.json()) as { data: Partial<DeviceSettings> | null };
        if (data) {
          this.settings = { ...DEFAULT_DEVICE_SETTINGS, ...data };
        }
      }
    } catch (error) {
      console.warn("Failed to load device settings:", error);
      // Use defaults
    }

    this.initialized = true;
    this.notifyListeners();
  }

  /**
   * Update settings (admin only)
   */
  async update(updates: Partial<DeviceSettings>): Promise<void> {
    // Local singleton state only. Persisting device settings is an admin action that
    // goes through the guarded settings document API, not this client-side singleton.
    this.settings = {
      ...this.settings,
      ...updates,
    };
    this.notifyListeners();
  }

  /**
   * Reset to defaults
   */
  reset(): void {
    this.settings = { ...DEFAULT_DEVICE_SETTINGS };
    this.notifyListeners();
  }

  /**
   * Subscribe to settings changes
   */
  subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    // Immediately call with current settings
    listener(this.settings);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of changes
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.settings);
      } catch (error) {
        console.error("Settings listener error:", error);
      }
    });
  }

  /**
   * Get temple location
   */
  getTempleLocation(): TempleLocation {
    return { ...this.settings.templeLocation };
  }

  /**
   * Get share templates
   */
  getShareTemplates() {
    return { ...this.settings.shareTemplates };
  }

  /**
   * Get default navigation app
   */
  getDefaultNavigationApp(): "google" | "apple" | "waze" | "any" {
    return this.settings.defaultNavigationApp;
  }

  /**
   * Get notification defaults
   */
  getNotificationDefaults() {
    return { ...this.settings.notificationDefaults };
  }

  /**
   * Get calendar defaults
   */
  getCalendarDefaults() {
    return { ...this.settings.calendarDefaults };
  }

  /**
   * Validate settings
   */
  validate(settings: Partial<DeviceSettings>): string[] {
    const errors: string[] = [];

    if (settings.templeLocation) {
      const loc = settings.templeLocation;
      if (typeof loc.latitude !== "number" || loc.latitude < -90 || loc.latitude > 90) {
        errors.push("Temple latitude must be between -90 and 90");
      }
      if (typeof loc.longitude !== "number" || loc.longitude < -180 || loc.longitude > 180) {
        errors.push("Temple longitude must be between -180 and 180");
      }
    }

    if (settings.notificationDefaults) {
      const notif = settings.notificationDefaults;
      // Parse time from HH:mm format
      const [hours, minutes] = (notif.dailyPanchangaTime || "06:00").split(":").map(Number);
      if (isNaN(hours) || hours < 0 || hours > 23) {
        errors.push("Daily Panchanga reminder hour must be between 0 and 23");
      }
      if (isNaN(minutes) || minutes < 0 || minutes > 59) {
        errors.push("Daily Panchanga reminder minute must be between 0 and 59");
      }
    }

    return errors;
  }
}

// Singleton instance
export const deviceSettingsService = new DeviceSettingsService();
