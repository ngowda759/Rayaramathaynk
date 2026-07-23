"use client";

/**
 * NotificationToggle Component
 * Toggle button for enabling/disabling notifications
 */

import { useState } from "react";
import { useNotifications } from "@/lib/device/hooks";
import { Bell, BellOff, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface NotificationToggleProps {
  variant?: "button" | "switch";
  size?: "default" | "sm" | "icon" | "icon-sm";
  className?: string;
  onEnabled?: () => void;
  onDisabled?: () => void;
}

export function NotificationToggle({
  variant = "button",
  size = "sm",
  className = "",
  onEnabled,
  onDisabled,
}: NotificationToggleProps) {
  const notifications = useNotifications();
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    if (notifications.isGranted) {
      // Already enabled, could show settings
      notifications.showTest();
    } else if (!notifications.isDenied) {
      // Request permission
      setIsLoading(true);
      const permission = await notifications.requestPermission();
      setIsLoading(false);

      if (permission === "granted") {
        onEnabled?.();
        notifications.show({
          title: "Notifications Enabled",
          body: "You'll receive updates and reminders from the temple",
        });
      }
    }
  };

  if (variant === "switch") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Switch
          checked={notifications.isGranted}
          onCheckedChange={handleToggle}
          disabled={isLoading || notifications.isDenied}
        />
        <span className="text-sm text-stone-600">
          {notifications.isGranted ? "Notifications On" : "Notifications Off"}
        </span>
      </div>
    );
  }

  return (
    <Button
      variant={notifications.isGranted ? "primary" : "outline"}
      size={size}
      className={className}
      onClick={handleToggle}
      disabled={isLoading || notifications.isDenied}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : notifications.isGranted ? (
        <Bell className="h-4 w-4" />
      ) : notifications.isDenied ? (
        <BellOff className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
    </Button>
  );
}

/**
 * NotificationBell Component
 * A bell icon that shows notification status
 */
interface NotificationBellProps {
  className?: string;
  showBadge?: boolean;
}

export function NotificationBell({
  className = "",
  showBadge = true,
}: NotificationBellProps) {
  const notifications = useNotifications();

  return (
    <div className="relative inline-block">
      <Button
        variant="ghost"
        size="icon"
        className={className}
        onClick={() => {
          if (!notifications.isGranted && !notifications.isDenied) {
            notifications.requestPermission();
          } else if (notifications.isGranted) {
            notifications.showTest();
          }
        }}
      >
        <Bell className="h-5 w-5" />
        {notifications.isGranted && showBadge && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500" />
        )}
        {!notifications.isGranted && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-stone-400" />
        )}
      </Button>
    </div>
  );
}

/**
 * NotifyMeButton Component
 * Button to subscribe to event notifications
 */
interface NotifyMeButtonProps {
  eventId: string;
  eventTitle: string;
  eventDate: Date;
  minutesBefore?: number;
  variant?: "primary" | "outline" | "ghost";
  size?: "default" | "sm" | "icon" | "icon-sm";
  className?: string;
}

export function NotifyMeButton({
  eventId,
  eventTitle,
  eventDate,
  minutesBefore = 30,
  variant = "outline",
  size = "sm",
  className = "",
}: NotifyMeButtonProps) {
  const notifications = useNotifications();
  const [isNotify, setIsNotify] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const notificationId = `event-${eventId}`;
  const isScheduled = notifications.getScheduled().some(n => n.id === notificationId);

  const handleNotify = async () => {
    setIsLoading(true);

    if (!notifications.isGranted) {
      const permission = await notifications.requestPermission();
      if (permission !== "granted") {
        setIsLoading(false);
        return;
      }
    }

    if (isScheduled) {
      notifications.cancel(notificationId);
      setIsNotify(false);
    } else {
      notifications.scheduleEventReminder(
        eventId,
        eventTitle,
        eventDate,
        minutesBefore
      );
      setIsNotify(true);
    }

    setIsLoading(false);
  };

  return (
    <Button
      variant={isNotify ? "primary" : variant}
      size={size}
      className={className}
      onClick={handleNotify}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : isNotify ? (
        <Check className="mr-2 h-4 w-4" />
      ) : (
        <Bell className="mr-2 h-4 w-4" />
      )}
      {isNotify ? "Notified" : "Notify Me"}
    </Button>
  );
}

/**
 * NotificationStatus Component
 * Shows current notification permission status
 */
interface NotificationStatusProps {
  className?: string;
}

export function NotificationStatus({ className = "" }: NotificationStatusProps) {
  const notifications = useNotifications();

  const getStatusInfo = () => {
    if (!notifications.isSupported) {
      return {
        label: "Not Supported",
        description: "Your browser doesn't support notifications",
        color: "bg-stone-100 text-stone-600",
      };
    }

    if (notifications.isGranted) {
      return {
        label: "Enabled",
        description: `${notifications.scheduledCount} reminder${notifications.scheduledCount !== 1 ? 's' : ''} scheduled`,
        color: "bg-green-100 text-green-700",
      };
    }

    if (notifications.isDenied) {
      return {
        label: "Blocked",
        description: "Notifications are blocked. Check browser settings.",
        color: "bg-red-100 text-red-700",
      };
    }

    return {
      label: "Not Set Up",
      description: "Enable notifications to receive reminders",
      color: "bg-yellow-100 text-yellow-700",
    };
  };

  const status = getStatusInfo();

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
        {status.label}
      </div>
      <span className="text-sm text-stone-500">{status.description}</span>
    </div>
  );
}
