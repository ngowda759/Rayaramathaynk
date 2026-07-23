/**
 * Device Features Platform - Type Definitions
 * Central types for all device-related features
 */

// ============================================================================
// Platform & Browser Types
// ============================================================================

export type Platform = "android" | "ios" | "desktop" | "unknown";

export type Browser =
  | "chrome"
  | "firefox"
  | "safari"
  | "edge"
  | "opera"
  | "samsung"
  | "unknown";

export interface DeviceInfo {
  platform: Platform;
  browser: Browser;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
  userAgent: string;
  language: string;
}

// ============================================================================
// Capability Types
// ============================================================================

export interface Capabilities {
  /** Camera access for QR scanning */
  cameraSupported: boolean;
  /** Geolocation API */
  gpsSupported: boolean;
  /** Web Share API (mobile native share) */
  shareSupported: boolean;
  /** Web Notifications API */
  notificationSupported: boolean;
  /** Calendar URL schemes or API */
  calendarSupported: boolean;
  /** Clipboard API */
  clipboardSupported: boolean;
  /** Touch events support */
  touchSupported: boolean;
  /** Online/offline detection */
  offlineSupported: boolean;
  /** Service Worker / PWA support */
  pwaSupported: boolean;
  /** BeforeInstallPrompt event support */
  installPromptSupported: boolean;
  /** MediaDevices API */
  mediaDevicesSupported: boolean;
  /** Stream API for camera */
  streamSupported: boolean;
  /** Flashlight/Torch control */
  torchSupported: boolean;
}

// ============================================================================
// Permission Types
// ============================================================================

export type PermissionState = "granted" | "denied" | "prompt" | "unsupported";

export interface PermissionStatus {
  camera: PermissionState;
  location: PermissionState;
  notifications: PermissionState;
  clipboard: PermissionState;
}

export type PermissionType = "camera" | "location" | "notifications" | "clipboard";

export interface PermissionRequestResult {
  type: PermissionType;
  state: PermissionState;
  error?: string;
}

// ============================================================================
// Location Types
// ============================================================================

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationPosition extends Coordinates {
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface LocationError {
  code: number;
  message: string;
}

export type LocationWatchId = number;

export interface TempleLocation extends Coordinates {
  name: string;
  address: string;
  phone?: string;
}

// ============================================================================
// Share Types
// ============================================================================

export interface ShareData {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}

export type ShareProvider =
  | "native"
  | "whatsapp"
  | "facebook"
  | "telegram"
  | "email"
  | "twitter"
  | "linkedin"
  | "copy";

export interface ShareOptions {
  providers?: ShareProvider[];
  title?: string;
  text?: string;
  url?: string;
  onCopySuccess?: () => void;
  onCopyError?: () => void;
}

// ============================================================================
// Calendar Types
// ============================================================================

export interface CalendarEvent {
  title: string;
  description?: string;
  location?: string;
  startDate: Date;
  endDate: Date;
  allDay?: boolean;
  url?: string;
}

export type CalendarProvider = "google" | "apple" | "outlook" | "ics";

export interface CalendarOptions {
  provider?: CalendarProvider;
  title?: string;
  description?: string;
  location?: string;
  startDate: Date;
  endDate: Date;
  allDay?: boolean;
}

// ============================================================================
// Notification Types
// ============================================================================

export interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
  silent?: boolean;
}

export type NotificationType =
  | "event"
  | "seva"
  | "festival"
  | "reminder"
  | "announcement"
  | "donation";

export interface ScheduledNotification extends NotificationOptions {
  id: string;
  scheduledTime: Date;
  type: NotificationType;
  relatedId?: string;
}

// ============================================================================
// QR Scanner Types
// ============================================================================

export type CameraDirection = "environment" | "user";

export interface QRScannerOptions {
  continuous?: boolean;
  cameraDirection?: CameraDirection;
  showViewfinder?: boolean;
  aspectRatio?: number;
}

export interface QRCodeResult {
  text: string;
  format?: string;
  timestamp: number;
}

export interface QRScannerState {
  isScanning: boolean;
  isPaused: boolean;
  cameraDirection: CameraDirection;
  hasTorch: boolean;
  torchEnabled: boolean;
  error: string | null;
  lastResult: QRCodeResult | null;
}

// ============================================================================
// Device Settings Types
// ============================================================================

export interface DeviceSettings {
  templeLocation: TempleLocation;
  defaultNavigationApp: "google" | "apple" | "waze" | "any";
  notificationDefaults: {
    dailyPanchangaReminder: boolean;
    dailyPanchangaTime: string; // HH:mm format
    festivalReminderOffset: number; // days before
    eventReminderOffset: number; // minutes before
  };
  calendarDefaults: {
    defaultProvider: CalendarProvider;
    eventDuration: number; // minutes
    reminderTime: number; // minutes before
  };
  shareTemplates: {
    event: string;
    seva: string;
    gallery: string;
    donation: string;
    quote: string;
    panchanga: string;
  };
  qrScannerDefaults: {
    continuous: boolean;
    cameraDirection: CameraDirection;
  };
}

export const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
  templeLocation: {
    latitude: 13.096788188005597,
    longitude: 77.58461022456063,
    name: "Sri Raghavendra Swamy Matha",
    address: "428/20, 8th A Cross Rd, Yelahanka Satellite Town, Yelahanka, Bengaluru, Karnataka 560064",
    phone: "+91 80 2332 3456",
  },
  defaultNavigationApp: "google",
  notificationDefaults: {
    dailyPanchangaReminder: true,
    dailyPanchangaTime: "06:00",
    festivalReminderOffset: 7,
    eventReminderOffset: 30,
  },
  calendarDefaults: {
    defaultProvider: "google",
    eventDuration: 60,
    reminderTime: 15,
  },
  shareTemplates: {
    event: "Join us for {title} at Sri Raghavendra Swamy Matha! {date}",
    seva: "Booked {title} at Sri Raghavendra Swamy Matha - {date}",
    gallery: "Beautiful moments from Sri Raghavendra Swamy Matha!",
    donation: "Support Sri Raghavendra Swamy Matha's divine services. {url}",
    quote: '"{quote}" - Sri Raghavendra Swamy Matha',
    panchanga: "Today's Panchanga from Sri Raghavendra Swamy Matha: {summary}",
  },
  qrScannerDefaults: {
    continuous: true,
    cameraDirection: "environment",
  },
};
