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

// Type exports
export type { PermissionState, PermissionType } from "@/types/device";
