"use client";

/**
 * usePermissions Hook
 * Hook for managing and tracking permissions
 */

import { useState, useEffect, useCallback } from "react";
import {
  queryPermission,
  requestPermission,
  getPermissionManager,
  isPermissionSupported,
  getAllPermissionStates,
  getPermissionInfo,
} from "../permissions";
import type {
  PermissionState,
  PermissionType,
  PermissionRequestResult,
} from "@/types/device";

/**
 * Hook for a single permission type
 */
export function usePermission(type: PermissionType): {
  state: PermissionState;
  isSupported: boolean;
  isGranted: boolean;
  isDenied: boolean;
  isPrompt: boolean;
  request: () => Promise<PermissionRequestResult>;
  info: { label: string; description: string; icon: string };
} {
  const [state, setState] = useState<PermissionState>("prompt");
  const isSupported = isPermissionSupported(type);
  const info = getPermissionInfo(type);

  // Get initial state
  useEffect(() => {
    if (!isSupported) {
      setState("unsupported");
      return;
    }

    queryPermission(type).then(setState);
  }, [type, isSupported]);

  // Subscribe to permission changes
  useEffect(() => {
    if (!isSupported) return;

    const manager = getPermissionManager();
    const unsubscribe = manager.subscribe(type, setState);

    return unsubscribe;
  }, [type, isSupported]);

  const request = useCallback(async () => {
    const result = await requestPermission(type);
    setState(result.state);
    return result;
  }, [type]);

  return {
    state,
    isSupported,
    isGranted: state === "granted",
    isDenied: state === "denied",
    isPrompt: state === "prompt",
    request,
    info,
  };
}

/**
 * Hook for multiple permissions
 */
export function usePermissions(
  types: PermissionType[]
): Record<PermissionType, PermissionState> {
  const [states, setStates] = useState<Record<PermissionType, PermissionState>>(
    types.reduce((acc, type) => ({ ...acc, [type]: "prompt" as PermissionState }), {} as Record<PermissionType, PermissionState>)
  );

  useEffect(() => {
    // Initialize states
    const initStates: Record<string, PermissionState> = {};
    types.forEach((type) => {
      initStates[type] = isPermissionSupported(type) ? "prompt" : "unsupported";
    });
    setStates(initStates as Record<PermissionType, PermissionState>);

    // Fetch actual states
    getAllPermissionStates().then((allStates) => {
      const filtered: Record<string, PermissionState> = {};
      types.forEach((type) => {
        filtered[type] = allStates[type];
      });
      setStates(filtered as Record<PermissionType, PermissionState>);
    });

    // Subscribe to changes
    const manager = getPermissionManager();
    const unsubscribers = types.map((type) =>
      manager.subscribe(type, (newState) => {
        setStates((prev) => ({ ...prev, [type]: newState }));
      })
    );

    // Start auto-recheck
    manager.startAutoRecheck(30000);

    return () => {
      unsubscribers.forEach((unsub) => unsub());
      manager.stopAutoRecheck();
    };
  }, [types.join(",")]);

  return states;
}

/**
 * Hook for camera permission
 */
export function useCameraPermission() {
  return usePermission("camera");
}

/**
 * Hook for location permission
 */
export function useLocationPermission() {
  return usePermission("location");
}

/**
 * Hook for notification permission
 */
export function useNotificationPermission() {
  return usePermission("notifications");
}

/**
 * Hook for clipboard permission
 */
export function useClipboardPermission() {
  return usePermission("clipboard");
}

/**
 * Hook with permission dialog state management
 */
export function usePermissionWithDialog(type: PermissionType): {
  state: PermissionState;
  isSupported: boolean;
  isGranted: boolean;
  isDenied: boolean;
  isPrompt: boolean;
  showDialog: boolean;
  dialogReason: string;
  openDialog: () => void;
  closeDialog: () => void;
  request: () => Promise<PermissionRequestResult>;
  requestWithDialog: () => Promise<PermissionRequestResult>;
  info: { label: string; description: string; icon: string };
} {
  const [showDialog, setShowDialog] = useState(false);
  const [dialogReason, setDialogReason] = useState("");

  const permission = usePermission(type);

  const openDialog = useCallback(() => {
    setShowDialog(true);
  }, []);

  const closeDialog = useCallback(() => {
    setShowDialog(false);
    setDialogReason("");
  }, []);

  const requestWithDialog = useCallback(async () => {
    const info = getPermissionInfo(type);

    if (permission.isPrompt) {
      setDialogReason(info.description);
      setShowDialog(true);
    }

    const result = await permission.request();
    setShowDialog(false);
    return result;
  }, [type, permission]);

  return {
    ...permission,
    showDialog,
    dialogReason,
    openDialog,
    closeDialog,
    request: requestWithDialog,
    requestWithDialog,
  };
}

/**
 * Hook for permission summary
 */
export function usePermissionSummary(): {
  totalPermissions: number;
  grantedPermissions: number;
  deniedPermissions: number;
  promptPermissions: number;
  unsupportedPermissions: number;
  allGranted: boolean;
  anyDenied: boolean;
  anyUnsupported: boolean;
} {
  const types: PermissionType[] = ["camera", "location", "notifications", "clipboard"];
  const states = usePermissions(types);

  const summary = {
    totalPermissions: types.length,
    grantedPermissions: 0,
    deniedPermissions: 0,
    promptPermissions: 0,
    unsupportedPermissions: 0,
    allGranted: false,
    anyDenied: false,
    anyUnsupported: false,
  };

  for (const type of types) {
    switch (states[type]) {
      case "granted":
        summary.grantedPermissions++;
        break;
      case "denied":
        summary.deniedPermissions++;
        break;
      case "prompt":
        summary.promptPermissions++;
        break;
      case "unsupported":
        summary.unsupportedPermissions++;
        break;
    }
  }

  summary.allGranted = summary.grantedPermissions === summary.totalPermissions;
  summary.anyDenied = summary.deniedPermissions > 0;
  summary.anyUnsupported = summary.unsupportedPermissions > 0;

  return summary;
}
