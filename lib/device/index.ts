/**
 * Device Features Platform - Main Export
 * 
 * A unified device abstraction layer for native browser capabilities.
 * Supports both web and future native mobile packaging (Capacitor/React Native).
 * 
 * @example
 * // Import all device features
 * import { useQRScanner, useLocation, useShare, useNotifications } from '@/lib/device';
 * 
 * // Import all device components
 * import { QRScannerButton, LocationButton, ShareButton, NotifyMeButton } from '@/components/device';
 */

// Re-export types from types/device
export * from "@/types/device";

// ============================================
// Capabilities
// ============================================

export { getCapabilities } from "./capabilities";

// ============================================
// Permissions
// ============================================

export { getAllPermissionStates } from "./permissions";

// ============================================
// Settings
// ============================================

export { deviceSettingsService } from "./settings";

// ============================================
// Actions (for Raya AI integration)
// ============================================

export { deviceActionRegistry, useDeviceActions } from "./actions";
export { useActionRegistry } from "./actions/index";
export type { DeviceActionType, DeviceAction, DeviceActionResult } from "./actions";

// ============================================
// Device-specific services
// ============================================

export { qrScanner } from "./qr/scanner";
export { locationService } from "./location";
export { shareService } from "./share";
export { calendarService } from "./calendar";
export { notificationsService } from "./notifications";

// ============================================
// Hooks
// ============================================

export {
  useDevice,
  useCapabilities,
  useOnlineStatus,
  useCapability,
  usePWAInstall,
  useOrientation,
  useBattery,
  useConnection,
} from "./hooks/useDevice";

export {
  usePermission,
  usePermissions,
  useCameraPermission,
  useLocationPermission,
  useNotificationPermission,
  useClipboardPermission,
  usePermissionWithDialog,
  usePermissionSummary,
} from "./hooks/usePermissions";

export { useQRScanner } from "./hooks/useQRScanner";
export { useLocation, useTempleDistance } from "./hooks/useLocation";
export { useShare, useShareContent } from "./hooks/useShare";
export { useCalendar, useAddToCalendar } from "./hooks/useCalendar";
export { useNotifications, NotificationProvider } from "./hooks/useNotifications";

// ============================================
// Components
// ============================================

export {
  CapabilityBadge,
  CapabilityGrid,
  CapabilityGroup,
  DeviceCapabilitiesSummary,
} from "@/components/device/CapabilityBadge";

export {
  PermissionDialog,
  PermissionCard,
  PermissionGate,
  PermissionRequestButton,
} from "@/components/device/PermissionDialog";

export {
  QRScanner,
  QRScannerButton,
  CompactQRScanner,
} from "@/components/device/QRScanner";

export {
  LocationButton,
  SimpleLocationButton,
} from "@/components/device/LocationButton";

export {
  DirectionsButton,
  DirectionsLink,
} from "@/components/device/DirectionsButton";

export {
  ShareButton,
  ShareIconButton,
  ShareDropdown,
} from "@/components/device/ShareButton";

export {
  CalendarButton,
  SimpleCalendarButton,
} from "@/components/device/CalendarButton";

export {
  NotificationToggle,
  NotificationBell,
  NotifyMeButton,
  NotificationStatus,
} from "@/components/device/NotificationToggle";

// ============================================
// Constants
// ============================================

export { DEFAULT_DEVICE_SETTINGS } from "@/types/device";
