/**
 * Device Capabilities Detection
 * Detects browser/device capabilities for progressive enhancement
 */

import type { Capabilities, DeviceInfo, Platform, Browser } from "@/types/device";

/**
 * Detect the current platform
 */
export function detectPlatform(): Platform {
  if (typeof window === "undefined") return "unknown";

  const userAgent = window.navigator.userAgent.toLowerCase();

  if (/android/.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/.test(userAgent)) return "ios";
  if (/tablet|ipad/.test(userAgent) && /^(?!.*android)/i.test(userAgent)) return "ios";

  return "desktop";
}

/**
 * Detect the current browser
 */
export function detectBrowser(): Browser {
  if (typeof window === "undefined") return "unknown";

  const userAgent = window.navigator.userAgent.toLowerCase();
  const vendor = window.navigator.vendor?.toLowerCase() || "";

  if (/edg\/|edge/.test(userAgent)) return "edge";
  if (/opr\//.test(userAgent) || /opera/.test(userAgent)) return "opera";
  if (/chrome/.test(userAgent) && vendor === "google inc.") return "chrome";
  if (/firefox/.test(userAgent)) return "firefox";
  if (/safari/.test(userAgent) && vendor === "apple computer") return "safari";
  if (/samsungbrowser/.test(userAgent)) return "samsung";

  return "unknown";
}

/**
 * Check if device is a mobile device
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    window.navigator.userAgent
  );
}

/**
 * Check if device is a tablet
 */
export function isTabletDevice(): boolean {
  if (typeof window === "undefined") return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  const hasLargeScreen = window.screen?.width >= 768;

  return (
    (/ipad|tablet|android(?!.*mobile)/.test(userAgent) || hasLargeScreen) &&
    !/phone|mobile/.test(userAgent)
  );
}

/**
 * Check if device has touch support
 */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;

  // Modern browsers
  if ("ontouchstart" in window) return true;

  // Touch point support
  if (window.navigator.maxTouchPoints > 0) return true;

  // MS Pointer Events API (legacy IE support)
  const nav = window.navigator as Navigator & { msMaxTouchPoints?: number };
  if (nav.msMaxTouchPoints && nav.msMaxTouchPoints > 0) return true;

  return false;
}

/**
 * Check if Service Workers are supported (PWA capability)
 */
export function isServiceWorkerSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in window.navigator;
}

/**
 * Check if Web Share API is supported
 */
export function isShareSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "share" in window.navigator && typeof window.navigator.share === "function";
}

/**
 * Check if Web Notifications are supported
 */
export function isNotificationSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "Notification" in window;
}

/**
 * Check if Geolocation is supported
 */
export function isGeolocationSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "geolocation" in window.navigator;
}

/**
 * Check if Clipboard API is supported
 */
export function isClipboardSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "clipboard" in window.navigator || "ClipboardItem" in window;
}

/**
 * Check if MediaDevices API is supported
 */
export function isMediaDevicesSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "mediaDevices" in window.navigator && "getUserMedia" in window.navigator.mediaDevices;
}

/**
 * Check if Stream API is supported (for camera access)
 */
export function isStreamSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "mediaDevices" in window.navigator && "getUserMedia" in window.navigator.mediaDevices;
}

/**
 * Check if torch/flashlight control is supported
 */
export function isTorchSupported(): boolean {
  if (typeof window === "undefined") return false;
  // Torch is typically controlled via MediaStreamTrack
  return "mediaDevices" in window.navigator && "getUserMedia" in window.navigator.mediaDevices;
}

/**
 * Check if offline/online detection is supported
 */
export function isOfflineSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "onLine" in window.navigator;
}

/**
 * Check if BeforeInstallPrompt event is supported (PWA install)
 */
export function isInstallPromptSupported(): boolean {
  if (typeof window === "undefined") return false;
  // This is detected at runtime, not compile time
  return true;
}

/**
 * Get comprehensive device information
 */
export function getDeviceInfo(): DeviceInfo {
  if (typeof window === "undefined") {
    return {
      platform: "unknown",
      browser: "unknown",
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouchDevice: false,
      userAgent: "",
      language: "en",
    };
  }

  return {
    platform: detectPlatform(),
    browser: detectBrowser(),
    isMobile: isMobileDevice(),
    isTablet: isTabletDevice(),
    isDesktop: !isMobileDevice() && !isTabletDevice(),
    isTouchDevice: isTouchDevice(),
    userAgent: window.navigator.userAgent,
    language: window.navigator.language || "en",
  };
}

/**
 * Get all device capabilities
 */
export function getCapabilities(): Capabilities {
  return {
    cameraSupported: isMediaDevicesSupported(),
    gpsSupported: isGeolocationSupported(),
    shareSupported: isShareSupported(),
    notificationSupported: isNotificationSupported(),
    calendarSupported: true, // URL schemes work everywhere
    clipboardSupported: isClipboardSupported(),
    touchSupported: isTouchDevice(),
    offlineSupported: isOfflineSupported(),
    pwaSupported: isServiceWorkerSupported(),
    installPromptSupported: isInstallPromptSupported(),
    mediaDevicesSupported: isMediaDevicesSupported(),
    streamSupported: isStreamSupported(),
    torchSupported: isTorchSupported(),
  };
}

/**
 * Check a specific capability
 */
export function hasCapability<K extends keyof Capabilities>(
  capability: K
): boolean {
  return getCapabilities()[capability];
}

/**
 * Get capabilities that are NOT supported
 */
export function getUnsupportedCapabilities(): string[] {
  const capabilities = getCapabilities();
  const unsupported: string[] = [];

  for (const [key, supported] of Object.entries(capabilities)) {
    if (!supported) {
      unsupported.push(key);
    }
  }

  return unsupported;
}

/**
 * Capability detection hooks for React components
 */
export const capabilityFlags = {
  get CAMERA_SUPPORTED() { return isMediaDevicesSupported(); },
  get GPS_SUPPORTED() { return isGeolocationSupported(); },
  get SHARE_SUPPORTED() { return isShareSupported(); },
  get NOTIFICATION_SUPPORTED() { return isNotificationSupported(); },
  get CALENDAR_SUPPORTED() { return true; },
  get CLIPBOARD_SUPPORTED() { return isClipboardSupported(); },
  get TOUCH_SUPPORTED() { return isTouchDevice(); },
  get OFFLINE_SUPPORTED() { return isOfflineSupported(); },
  get PWA_SUPPORTED() { return isServiceWorkerSupported(); },
  get INSTALL_PROMPT_SUPPORTED() { return isInstallPromptSupported(); },
};
