/**
 * Device Hooks - Barrel Export
 */

// Device hooks
export { useDevice, useCapabilities, useOnlineStatus, useCapability, usePWAInstall, useOrientation, useBattery, useConnection } from "./useDevice";

// Permission hooks
export {
  usePermission,
  usePermissions,
  useCameraPermission,
  useLocationPermission,
  useNotificationPermission,
  useClipboardPermission,
  usePermissionWithDialog,
  usePermissionSummary,
} from "./usePermissions";

// QR Scanner hooks
export { useQRScanner } from "./useQRScanner";

// Location hooks
export { useLocation, useTempleDistance } from "./useLocation";

// Share hooks
export { useShare, useShareContent } from "./useShare";

// Calendar hooks
export { useCalendar, useAddToCalendar } from "./useCalendar";

// Notification hooks
export { useNotifications, NotificationProvider } from "./useNotifications";

// Action Registry hooks
export { useActionRegistry } from "@/lib/device/actions";

// Type exports
export type { PermissionState, PermissionType } from "@/types/device";
