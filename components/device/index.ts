/**
 * Device Components - Barrel Export
 */

export {
  CapabilityBadge,
  CapabilityGrid,
  CapabilityGroup,
  DeviceCapabilitiesSummary,
} from "./CapabilityBadge";

export {
  PermissionDialog,
  PermissionCard,
  PermissionGate,
  PermissionRequestButton,
} from "./PermissionDialog";

// QR Scanner components
export { QRScanner, QRScannerButton, CompactQRScanner } from "./QRScanner";

// Location components
export { LocationButton, SimpleLocationButton } from "./LocationButton";
export { DirectionsButton, DirectionsLink } from "./DirectionsButton";

// Share components
export { ShareButton, ShareIconButton, ShareDropdown } from "./ShareButton";

// Calendar components
export { CalendarButton, SimpleCalendarButton } from "./CalendarButton";

// Notification components
export { NotificationToggle, NotificationBell, NotifyMeButton, NotificationStatus } from "./NotificationToggle";

// Floating Action Bar components
export {
  FloatingActionBar,
  CompactActionBar,
  StickyActionBar,
} from "./FloatingActionBar";
export type {
  ActionBarAction,
  FloatingActionBarProps,
  StickyActionBarProps,
} from "./FloatingActionBar";
