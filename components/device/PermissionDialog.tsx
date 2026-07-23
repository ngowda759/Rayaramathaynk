"use client";

/**
 * PermissionDialog Component
 * Accessible dialog for requesting device permissions
 */

import { useState } from "react";
import { usePermissionWithDialog, usePermission } from "@/lib/device/hooks";
import type { PermissionType } from "@/types/device";
import {
  Camera,
  MapPin,
  Bell,
  Clipboard,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const permissionIcons: Record<PermissionType, React.ComponentType<{ className?: string }>> = {
  camera: Camera,
  location: MapPin,
  notifications: Bell,
  clipboard: Clipboard,
};

interface PermissionDialogProps {
  type: PermissionType;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  allowSkip?: boolean;
}

export function PermissionDialog({
  type,
  open: controlledOpen,
  onOpenChange,
  title,
  description,
  allowSkip = true,
}: PermissionDialogProps) {
  const permission = usePermissionWithDialog(type);
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle controlled state
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : permission.showDialog;

  const handleOpenChange = (newOpen: boolean) => {
    if (isControlled) {
      onOpenChange?.(newOpen);
    } else {
      if (!newOpen) {
        permission.closeDialog();
      }
    }
  };

  const handleRequest = async () => {
    setIsRequesting(true);
    setError(null);

    try {
      const result = await permission.request();
      if (result.state === "denied" || result.error) {
        setError(result.error || "Permission was denied");
      } else {
        handleOpenChange(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request permission");
    } finally {
      setIsRequesting(false);
    }
  };

  const Icon = permissionIcons[type];
  const defaultTitle = title || `Enable ${permission.info.label}`;
  const defaultDescription =
    description ||
    permission.info.description ||
    `Allow access to ${permission.info.label.toLowerCase()} to enable this feature.`;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
            <Icon className="h-6 w-6 text-orange-600" />
          </div>
          <DialogTitle>{defaultTitle}</DialogTitle>
          <DialogDescription>{defaultDescription}</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!permission.isSupported && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-700">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              {permission.info.label} is not supported in your browser. Some
              features may not work properly.
            </span>
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-col">
          <div className="flex w-full gap-2">
            {allowSkip && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleOpenChange(false)}
                disabled={isRequesting}
              >
                Not Now
              </Button>
            )}
            {permission.isGranted ? (
              <Button className="flex-1 bg-green-600 hover:bg-green-700" disabled>
                <Check className="mr-2 h-4 w-4" />
                Enabled
              </Button>
            ) : permission.isDenied ? (
              <Button className="flex-1" disabled>
                <AlertCircle className="mr-2 h-4 w-4" />
                Permission Denied
              </Button>
            ) : (
              <Button
                className="flex-1 bg-orange-600 hover:bg-orange-700"
                onClick={handleRequest}
                disabled={isRequesting || !permission.isSupported}
              >
                {isRequesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Requesting...
                  </>
                ) : (
                  <>
                    <Icon className="mr-2 h-4 w-4" />
                    Enable {permission.info.label}
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * PermissionCard Component
 * A compact card showing permission status
 */
interface PermissionCardProps {
  type: PermissionType;
  onRequest?: () => void;
  className?: string;
}

export function PermissionCard({
  type,
  onRequest,
  className = "",
}: PermissionCardProps) {
  const permission = usePermission(type);
  const Icon = permissionIcons[type];

  const statusColors: Record<string, string> = {
    granted: "bg-green-100 text-green-700",
    denied: "bg-red-100 text-red-700",
    prompt: "bg-yellow-100 text-yellow-700",
    unsupported: "bg-stone-100 text-stone-500",
  };

  const statusLabels: Record<string, string> = {
    granted: "Granted",
    denied: "Denied",
    prompt: "Required",
    unsupported: "Not Available",
  };

  return (
    <div
      className={`flex items-center justify-between rounded-lg border p-4 ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
          <Icon className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h4 className="font-medium text-stone-800">{permission.info.label}</h4>
          <p className="text-sm text-stone-500">{permission.info.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[permission.state] || statusColors.unsupported}`}
        >
          {statusLabels[permission.state] || statusLabels.unsupported}
        </span>
        {permission.isPrompt && (
          <Button size="sm" onClick={onRequest}>
            Enable
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * PermissionGate Component
 * Conditionally render children based on permission
 */
interface PermissionGateProps {
  type: PermissionType;
  fallback?: React.ReactNode;
  loading?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({
  type,
  fallback = null,
  loading = null,
  children,
}: PermissionGateProps) {
  const permission = usePermission(type);

  if (!permission.isSupported) {
    return <>{fallback}</>;
  }

  if (permission.isPrompt) {
    return <>{loading}</>;
  }

  if (permission.isGranted) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

/**
 * PermissionRequestButton Component
 * A button that opens the permission dialog when clicked
 */
interface PermissionRequestButtonProps {
  type: PermissionType;
  children?: React.ReactNode;
  variant?: "primary" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "icon" | "icon-sm";
  className?: string;
}

export function PermissionRequestButton({
  type,
  children,
  variant = "primary",
  size = "default",
  className = "",
}: PermissionRequestButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>
      <PermissionDialog type={type} open={open} onOpenChange={setOpen} />
    </>
  );
}
