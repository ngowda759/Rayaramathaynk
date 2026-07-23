/**
 * Permission Manager
 * Centralized permission management with auto-recheck
 */

import type { PermissionState, PermissionType, PermissionRequestResult } from "@/types/device";
import { isNotificationSupported, isGeolocationSupported, isMediaDevicesSupported, isClipboardSupported } from "../capabilities";

/**
 * Map permission name to our PermissionType
 */
function mapPermissionName(name: string): PermissionType | null {
  switch (name) {
    case "camera":
      return "camera";
    case "geolocation":
      return "location";
    case "notifications":
      return "notifications";
    case "clipboard-read":
    case "clipboard-write":
      return "clipboard";
    default:
      return null;
  }
}

/**
 * Convert Permission API state to our PermissionState
 */
function mapPermissionState(state: PermissionState | "default"): PermissionState {
  switch (state) {
    case "granted":
      return "granted";
    case "denied":
      return "denied";
    case "prompt":
    case "default":
      return "prompt";
    default:
      return "prompt";
  }
}

/**
 * Check if a permission type is supported
 */
export function isPermissionSupported(type: PermissionType): boolean {
  if (typeof window === "undefined") return false;
  if (!("permissions" in window.navigator)) return false;

  switch (type) {
    case "camera":
      return isMediaDevicesSupported();
    case "location":
      return isGeolocationSupported();
    case "notifications":
      return isNotificationSupported();
    case "clipboard":
      return isClipboardSupported();
    default:
      return false;
  }
}

/**
 * Get the permission name for the Permission API
 */
function getPermissionName(type: PermissionType): string {
  switch (type) {
    case "camera":
      return "camera";
    case "location":
      return "geolocation";
    case "notifications":
      return "notifications";
    case "clipboard":
      return "clipboard-read";
    default:
      return "";
  }
}

/**
 * Query the current permission state for a type
 */
export async function queryPermission(type: PermissionType): Promise<PermissionState> {
  if (!isPermissionSupported(type)) {
    return "unsupported";
  }

  try {
    const permissionName = getPermissionName(type);
    // Use type assertion for Permissions API
    const result = await (window.navigator.permissions as Permissions).query({
      name: permissionName as PermissionName,
    });
    return mapPermissionState(result.state);
  } catch {
    // For some permissions, we need to infer from usage
    // Fallback: try to determine based on feature check
    switch (type) {
      case "notifications":
        if ("Notification" in window) {
          return Notification.permission === "granted"
            ? "granted"
            : Notification.permission === "denied"
            ? "denied"
            : "prompt";
        }
        return "unsupported";
      case "location":
        return isGeolocationSupported() ? "prompt" : "unsupported";
      case "camera":
        return isMediaDevicesSupported() ? "prompt" : "unsupported";
      default:
        return "prompt";
    }
  }
}

/**
 * Request permission for a type
 */
export async function requestPermission(
  type: PermissionType
): Promise<PermissionRequestResult> {
  if (!isPermissionSupported(type)) {
    return {
      type,
      state: "unsupported",
      error: `${type} permission is not supported in this browser`,
    };
  }

  try {
    switch (type) {
      case "camera": {
        // Request camera by trying to access it
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((track) => track.stop());
        return { type, state: "granted" };
      }

      case "location": {
        return new Promise((resolve) => {
          if (!navigator.geolocation) {
            resolve({ type, state: "unsupported", error: "Geolocation not supported" });
            return;
          }

          navigator.geolocation.getCurrentPosition(
            () => resolve({ type, state: "granted" }),
            (error) => {
              if (error.code === error.PERMISSION_DENIED) {
                resolve({ type, state: "denied" });
              } else {
                resolve({ type, state: "prompt", error: error.message });
              }
            },
            { timeout: 10000, enableHighAccuracy: false }
          );
        });
      }

      case "notifications": {
        if (!("Notification" in window)) {
          return { type, state: "unsupported", error: "Notifications not supported" };
        }
        const permission = await Notification.requestPermission();
        return {
          type,
          state: permission === "granted" ? "granted" : permission === "denied" ? "denied" : "prompt",
        };
      }

      case "clipboard": {
        // Clipboard doesn't have a formal permission request
        // Try to write to clipboard as a test
        try {
          await navigator.clipboard.writeText("");
          return { type, state: "granted" };
        } catch {
          return { type, state: "prompt" };
        }
      }

      default:
        return { type, state: "prompt" };
    }
  } catch (error) {
    return {
      type,
      state: "denied",
      error: error instanceof Error ? error.message : "Permission request failed",
    };
  }
}

/**
 * Get all permission states
 */
export async function getAllPermissionStates(): Promise<Record<PermissionType, PermissionState>> {
  const types: PermissionType[] = ["camera", "location", "notifications", "clipboard"];

  const results: Record<string, PermissionState> = {};

  for (const type of types) {
    results[type] = await queryPermission(type);
  }

  return results as Record<PermissionType, PermissionState>;
}

/**
 * Check if we have permission for a type
 */
export async function hasPermission(type: PermissionType): Promise<boolean> {
  const state = await queryPermission(type);
  return state === "granted";
}

/**
 * Permission manager class with event handling
 */
export class PermissionManager {
  private listeners: Map<PermissionType, Set<(state: PermissionState) => void>> = new Map();
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.setupPermissionListeners();
    }
  }

  /**
   * Set up listeners for permission changes
   */
  private setupPermissionListeners(): void {
    // Some browsers support permission change events
    const permissionTypes: PermissionType[] = ["camera", "location", "notifications"];

    permissionTypes.forEach((type) => {
      if (isPermissionSupported(type)) {
        try {
          const permissionName = getPermissionName(type);
          (window.navigator.permissions as Permissions).query({
            name: permissionName as PermissionName,
          }).then((permissionStatus) => {
            permissionStatus.addEventListener("change", () => {
              this.notifyListeners(type, mapPermissionState(permissionStatus.state));
            });
          }).catch(() => {
            // Permission API not fully supported
          });
        } catch {
          // Permissions API not available
        }
      }
    });
  }

  /**
   * Subscribe to permission changes for a type
   */
  subscribe(
    type: PermissionType,
    callback: (state: PermissionState) => void
  ): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(type)?.delete(callback);
    };
  }

  /**
   * Notify all listeners of a permission change
   */
  private notifyListeners(type: PermissionType, state: PermissionState): void {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach((callback) => callback(state));
    }
  }

  /**
   * Start auto-rechecking permissions at intervals
   */
  startAutoRecheck(intervalMs: number = 30000): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(async () => {
      const states = await getAllPermissionStates();
      Object.entries(states).forEach(([type, state]) => {
        this.notifyListeners(type as PermissionType, state);
      });
    }, intervalMs);
  }

  /**
   * Stop auto-rechecking permissions
   */
  stopAutoRecheck(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Get current state for a permission type
   */
  async getState(type: PermissionType): Promise<PermissionState> {
    return queryPermission(type);
  }
}

// Singleton instance
let permissionManagerInstance: PermissionManager | null = null;

export function getPermissionManager(): PermissionManager {
  if (!permissionManagerInstance) {
    permissionManagerInstance = new PermissionManager();
  }
  return permissionManagerInstance;
}

/**
 * Convenience function to request multiple permissions
 */
export async function requestPermissions(
  types: PermissionType[]
): Promise<PermissionRequestResult[]> {
  return Promise.all(types.map((type) => requestPermission(type)));
}

/**
 * Get permission display info
 */
export function getPermissionInfo(type: PermissionType): {
  label: string;
  description: string;
  icon: string;
} {
  switch (type) {
    case "camera":
      return {
        label: "Camera",
        description: "Required for QR code scanning",
        icon: "camera",
      };
    case "location":
      return {
        label: "Location",
        description: "Used to show distance to temple",
        icon: "map-pin",
      };
    case "notifications":
      return {
        label: "Notifications",
        description: "Get reminders for events and sevas",
        icon: "bell",
      };
    case "clipboard":
      return {
        label: "Clipboard",
        description: "Copy links and share content",
        icon: "clipboard",
      };
    default:
      return {
        label: type,
        description: "",
        icon: "info",
      };
  }
}
