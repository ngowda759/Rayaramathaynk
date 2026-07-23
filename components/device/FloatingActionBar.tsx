"use client";

/**
 * Floating Action Bar Component
 * Context-aware action bar for mobile devices
 */

import { useState } from "react";
import {
  Share2,
  Calendar,
  Bell,
  Navigation,
  QrCode,
  Copy,
  Phone,
  Mail,
  MapPin,
  Check,
  Loader2,
  X,
} from "lucide-react";
import { useDevice, useActionRegistry } from "@/lib/device";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import toast from "react-hot-toast";

export interface ActionBarAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void | Promise<void>;
  loading?: boolean;
}

export interface FloatingActionBarProps {
  context?: "event" | "seva" | "temple" | "donation" | "gallery" | "contact" | "quote" | "panchanga";
  title?: string;
  url?: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  location?: string;
  phone?: string;
  email?: string;
  showShare?: boolean;
  showCalendar?: boolean;
  showNotify?: boolean;
  showNavigate?: boolean;
  showQR?: boolean;
  showCall?: boolean;
  showEmail?: boolean;
  showCopy?: boolean;
  onQRClick?: () => void;
  className?: string;
}

export function FloatingActionBar({
  context = "event",
  title,
  url,
  description,
  startDate,
  endDate,
  location,
  phone,
  email,
  showShare = true,
  showCalendar = true,
  showNotify = true,
  showNavigate = true,
  showQR = false,
  showCall = true,
  showEmail = true,
  showCopy = true,
  onQRClick,
  className = "",
}: FloatingActionBarProps) {
  const { isMobile, isTablet } = useDevice();
  const [showMenu, setShowMenu] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const actions = useActionRegistry({
    context: {
      title: title || "",
      description,
      url,
      startDate,
      endDate,
      location,
      phone,
      email,
    },
  });

  const handleAction = async (actionId: string, action: () => void | Promise<void>) => {
    setLoadingAction(actionId);
    try {
      await action();
    } finally {
      setLoadingAction(null);
      setShowMenu(false);
    }
  };

  const defaultActions: ActionBarAction[] = [
    ...(showShare ? [{
      id: "share",
      label: "Share",
      icon: Share2,
      onClick: () => actions.share(),
    }] : []),
    ...(showCalendar && startDate ? [{
      id: "calendar",
      label: "Add to Calendar",
      icon: Calendar,
      onClick: () => actions.addToCalendar(),
    }] : []),
    ...(showNotify ? [{
      id: "notify",
      label: "Notify Me",
      icon: Bell,
      onClick: () => {
        if (startDate) {
          actions.scheduleReminder(title || "Event Reminder", startDate);
          toast.success("Reminder set - you'll be notified before the event");
        }
      },
    }] : []),
    ...(showNavigate ? [{
      id: "navigate",
      label: "Get Directions",
      icon: Navigation,
      onClick: () => actions.navigate(),
    }] : []),
    ...(showQR ? [{
      id: "qr",
      label: "Show QR Code",
      icon: QrCode,
      onClick: () => onQRClick?.(),
    }] : []),
    ...(showCall && phone ? [{
      id: "call",
      label: "Call Temple",
      icon: Phone,
      onClick: () => actions.callPhone(),
    }] : []),
    ...(showEmail && email ? [{
      id: "email",
      label: "Email Temple",
      icon: Mail,
      onClick: () => actions.sendEmail(),
    }] : []),
    ...(showCopy && url ? [{
      id: "copy",
      label: "Copy Link",
      icon: Copy,
      onClick: async () => {
        const success = await actions.copyLink();
        if (success) {
          toast.success("Link copied to clipboard");
        }
      },
    }] : []),
  ].filter(Boolean) as ActionBarAction[];

  if (!isMobile && !isTablet) {
    return null;
  }

  if (defaultActions.length === 0) {
    return null;
  }

  return (
    <>
      {/* Floating Button */}
      <div
        className={`fixed bottom-6 right-6 z-50 flex flex-col-reverse gap-3 ${className}`}
      >
        {showMenu && (
          <div className="flex flex-col-reverse gap-2 mb-2">
            {defaultActions.map((action) => {
              const Icon = action.icon;
              const isLoading = loadingAction === action.id;
              
              return (
                <Button
                  key={action.id}
                  variant="secondary"
                  size="sm"
                  className="rounded-full px-4 shadow-lg flex items-center gap-2"
                  onClick={() => handleAction(action.id, action.onClick)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                  <span className="text-sm">{action.label}</span>
                </Button>
              );
            })}
          </div>
        )}
        
        <Button
          variant="primary"
          size="icon"
          className="h-14 w-14 rounded-full shadow-xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600"
          onClick={() => setShowMenu(!showMenu)}
        >
          {showMenu ? (
            <X className="h-6 w-6" />
          ) : (
            <Share2 className="h-6 w-6" />
          )}
        </Button>
      </div>

      {/* Action Menu Overlay */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setShowMenu(false)}
        />
      )}
    </>
  );
}

/**
 * Compact Floating Action Bar - just a single button
 */
interface CompactActionBarProps {
  primaryAction: {
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    label?: string;
  };
  secondaryActions?: ActionBarAction[];
  className?: string;
}

export function CompactActionBar({
  primaryAction,
  secondaryActions = [],
  className = "",
}: CompactActionBarProps) {
  const { isMobile, isTablet } = useDevice();
  const [showMenu, setShowMenu] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const PrimaryIcon = primaryAction.icon;

  const handleAction = async (actionId: string, action: () => void | Promise<void>) => {
    setLoadingAction(actionId);
    try {
      await action();
    } finally {
      setLoadingAction(null);
      setShowMenu(false);
    }
  };

  if (!isMobile && !isTablet) {
    return null;
  }

  return (
    <>
      <div className={`fixed bottom-6 right-6 z-50 flex flex-col-reverse gap-3 ${className}`}>
        {showMenu && secondaryActions.length > 0 && (
          <div className="flex flex-col-reverse gap-2 mb-2">
            {secondaryActions.map((action) => {
              const Icon = action.icon;
              const isLoading = loadingAction === action.id;
              
              return (
                <Button
                  key={action.id}
                  variant="secondary"
                  size="sm"
                  className="rounded-full px-4 shadow-lg flex items-center gap-2"
                  onClick={() => handleAction(action.id, action.onClick)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                  <span className="text-sm">{action.label}</span>
                </Button>
              );
            })}
          </div>
        )}
        
        <Button
          variant="primary"
          size="icon"
          className="h-14 w-14 rounded-full shadow-xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600"
          onClick={() => {
            if (secondaryActions.length > 0) {
              setShowMenu(!showMenu);
            } else {
              primaryAction.onClick();
            }
          }}
        >
          {loadingAction ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <PrimaryIcon className="h-6 w-6" />
          )}
        </Button>
      </div>

      {showMenu && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setShowMenu(false)}
        />
      )}
    </>
  );
}

/**
 * Sticky Action Bar - for event detail pages
 */
export interface StickyActionBarProps {
  title: string;
  startDate?: Date;
  location?: string;
  onShare?: () => void;
  onCalendar?: () => void;
  onNotify?: () => void;
  onNavigate?: () => void;
  className?: string;
}

export function StickyActionBar({
  title,
  startDate,
  location,
  onShare,
  onCalendar,
  onNotify,
  onNavigate,
  className = "",
}: StickyActionBarProps) {
  const { isMobile } = useDevice();
  const [scrolled, setScrolled] = useState(false);

  // Track scroll position
  if (typeof window !== "undefined") {
    // This effect should be moved to a useEffect in actual usage
  }

  if (!isMobile) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-stone-200 shadow-lg transition-transform duration-300 ${
        scrolled ? "translate-y-0" : "translate-y-full"
      } ${className}`}
    >
      <div className="flex items-center justify-around py-3 px-4">
        {onShare && (
          <button
            onClick={onShare}
            className="flex flex-col items-center gap-1 text-stone-600 hover:text-amber-600 transition-colors"
          >
            <Share2 className="h-5 w-5" />
            <span className="text-xs">Share</span>
          </button>
        )}
        
        {onCalendar && (
          <button
            onClick={onCalendar}
            className="flex flex-col items-center gap-1 text-stone-600 hover:text-amber-600 transition-colors"
          >
            <Calendar className="h-5 w-5" />
            <span className="text-xs">Calendar</span>
          </button>
        )}
        
        {onNotify && (
          <button
            onClick={onNotify}
            className="flex flex-col items-center gap-1 text-stone-600 hover:text-amber-600 transition-colors"
          >
            <Bell className="h-5 w-5" />
            <span className="text-xs">Notify</span>
          </button>
        )}
        
        {onNavigate && (
          <button
            onClick={onNavigate}
            className="flex flex-col items-center gap-1 text-stone-600 hover:text-amber-600 transition-colors"
          >
            <Navigation className="h-5 w-5" />
            <span className="text-xs">Directions</span>
          </button>
        )}
      </div>
    </div>
  );
}
