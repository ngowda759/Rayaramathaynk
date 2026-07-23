/**
 * Device Features Platform
 * Unified device abstraction layer for web and mobile
 *
 * @example
 * import { useDevice, usePermission, CapabilityBadge } from '@/lib/device';
 *
 * function MyComponent() {
 *   const { isMobile, platform } = useDevice();
 *   const { isGranted: hasLocation } = usePermission('location');
 *
 *   return (
 *     <div>
 *       <CapabilityBadge capability="gpsSupported" showLabel />
 *     </div>
 *   );
 * }
 */

// Types
export * from "./types";

// Capabilities
export * from "./capabilities";

// Permissions
export * from "./permissions";

// Hooks
export * from "./hooks";
