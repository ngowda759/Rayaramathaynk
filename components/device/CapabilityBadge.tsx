"use client";

/**
 * CapabilityBadge Component
 * Shows available device capabilities as badges
 */

import { useCapabilities } from "@/lib/device/hooks";
import type { Capabilities } from "@/types/device";
import {
  Camera,
  MapPin,
  Share2,
  Bell,
  Calendar,
  Clipboard,
  Smartphone,
  Wifi,
  Sparkles,
  Download,
} from "lucide-react";

type CapabilityKey = keyof Capabilities;

interface CapabilityBadgeProps {
  capability: CapabilityKey;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "success" | "warning" | "muted";
  className?: string;
}

const capabilityConfig: Record<
  CapabilityKey,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
  }
> = {
  cameraSupported: {
    label: "Camera",
    icon: Camera,
    description: "QR Code scanning",
  },
  gpsSupported: {
    label: "Location",
    icon: MapPin,
    description: "GPS navigation",
  },
  shareSupported: {
    label: "Share",
    icon: Share2,
    description: "Native sharing",
  },
  notificationSupported: {
    label: "Notifications",
    icon: Bell,
    description: "Push notifications",
  },
  calendarSupported: {
    label: "Calendar",
    icon: Calendar,
    description: "Add to calendar",
  },
  clipboardSupported: {
    label: "Clipboard",
    icon: Clipboard,
    description: "Copy & paste",
  },
  touchSupported: {
    label: "Touch",
    icon: Smartphone,
    description: "Touch interface",
  },
  offlineSupported: {
    label: "Offline",
    icon: Wifi,
    description: "Works offline",
  },
  pwaSupported: {
    label: "PWA",
    icon: Sparkles,
    description: "Installable app",
  },
  installPromptSupported: {
    label: "Install",
    icon: Download,
    description: "Can be installed",
  },
  mediaDevicesSupported: {
    label: "Media",
    icon: Camera,
    description: "Camera & microphone",
  },
  streamSupported: {
    label: "Stream",
    icon: Camera,
    description: "Live video stream",
  },
  torchSupported: {
    label: "Torch",
    icon: Sparkles,
    description: "Flashlight control",
  },
};

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
};

const iconSizeClasses = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

const variantClasses = {
  default: "bg-orange-100 text-orange-600",
  success: "bg-green-100 text-green-600",
  warning: "bg-yellow-100 text-yellow-600",
  muted: "bg-stone-100 text-stone-400",
};

export function CapabilityBadge({
  capability,
  showLabel = false,
  size = "md",
  variant = "default",
  className = "",
}: CapabilityBadgeProps) {
  const capabilities = useCapabilities();
  const isSupported = capabilities[capability];
  const config = capabilityConfig[capability];

  if (!config) return null;

  const Icon = config.icon;
  const activeVariant = isSupported ? variant : "muted";

  if (showLabel) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${variantClasses[activeVariant]} ${className}`}
        title={config.description}
      >
        <Icon className={iconSizeClasses[size]} />
        <span>{config.label}</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full ${sizeClasses[size]} ${variantClasses[activeVariant]} ${className}`}
      title={`${config.label}: ${isSupported ? "Supported" : "Not supported"}`}
    >
      <Icon className={iconSizeClasses[size]} />
    </div>
  );
}

/**
 * CapabilityGrid Component
 * Shows all capabilities in a grid
 */
interface CapabilityGridProps {
  capabilities?: Capabilities;
  size?: "sm" | "md" | "lg";
  showUnsupported?: boolean;
  className?: string;
}

export function CapabilityGrid({
  capabilities,
  size = "md",
  showUnsupported = false,
  className = "",
}: CapabilityGridProps) {
  const deviceCapabilities = useCapabilities();
  const caps = capabilities || deviceCapabilities;

  const keys = Object.keys(caps) as CapabilityKey[];

  const filteredKeys = showUnsupported
    ? keys
    : keys.filter((key) => caps[key]);

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {filteredKeys.map((key) => (
        <CapabilityBadge
          key={key}
          capability={key}
          size={size}
        />
      ))}
    </div>
  );
}

/**
 * CapabilityGroup Component
 * Groups related capabilities
 */
interface CapabilityGroupProps {
  title: string;
  capabilities: CapabilityKey[];
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function CapabilityGroup({
  title,
  capabilities,
  size = "md",
  className = "",
}: CapabilityGroupProps) {
  return (
    <div className={className}>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
        {title}
      </h4>
      <div className="flex flex-wrap gap-2">
        {capabilities.map((capability) => (
          <CapabilityBadge
            key={capability}
            capability={capability}
            size={size}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * DeviceCapabilitiesSummary Component
 * Shows a summary of key device capabilities
 */
interface DeviceCapabilitiesSummaryProps {
  className?: string;
}

export function DeviceCapabilitiesSummary({
  className = "",
}: DeviceCapabilitiesSummaryProps) {
  const caps = useCapabilities();

  const summaries = [
    {
      label: "QR Scanner",
      supported: caps.cameraSupported,
      icon: Camera,
    },
    {
      label: "Navigation",
      supported: caps.gpsSupported,
      icon: MapPin,
    },
    {
      label: "Share",
      supported: caps.shareSupported,
      icon: Share2,
    },
    {
      label: "Notifications",
      supported: caps.notificationSupported,
      icon: Bell,
    },
    {
      label: "Calendar",
      supported: caps.calendarSupported,
      icon: Calendar,
    },
  ];

  const supportedCount = summaries.filter((s) => s.supported).length;

  return (
    <div className={`rounded-lg border bg-white p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-stone-800">Device Features</h3>
        <span className="text-sm text-stone-500">
          {supportedCount} of {summaries.length} available
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {summaries.map(({ label, supported, icon: Icon }) => (
          <div
            key={label}
            className={`flex flex-col items-center rounded-lg p-2 text-center ${
              supported
                ? "bg-orange-50 text-orange-600"
                : "bg-stone-50 text-stone-400"
            }`}
          >
            <Icon className="mb-1 h-5 w-5" />
            <span className="text-xs">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
