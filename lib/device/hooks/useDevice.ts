"use client";

/**
 * useDevice Hook
 * Provides device information and capabilities
 */

import { useEffect, useState, useCallback, useSyncExternalStore } from "react";
import { getDeviceInfo, getCapabilities } from "../capabilities";
import type { DeviceInfo, Capabilities } from "@/types/device";

/**
 * Hook to get device information
 */
export function useDevice(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    platform: "unknown",
    browser: "unknown",
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isTouchDevice: false,
    userAgent: "",
    language: "en",
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Device info initialization
    setDeviceInfo(getDeviceInfo());
  }, []);

  return deviceInfo;
}

/**
 * Hook to get device capabilities
 */
export function useCapabilities(): Capabilities {
  // Capabilities are static for the session, but we use state for reactivity
  const [capabilities, setCapabilities] = useState<Capabilities>({
    cameraSupported: false,
    gpsSupported: false,
    shareSupported: false,
    notificationSupported: false,
    calendarSupported: true,
    clipboardSupported: false,
    touchSupported: false,
    offlineSupported: false,
    pwaSupported: false,
    installPromptSupported: false,
    mediaDevicesSupported: false,
    streamSupported: false,
    torchSupported: false,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Capabilities initialization
    setCapabilities(getCapabilities());
  }, []);

  return capabilities;
}

/**
 * Hook to check online/offline status
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Online status initialization
    setIsOnline(navigator.onLine);

    const handleOnline = () => // eslint-disable-next-line react-hooks/set-state-in-effect -- Online status handler
      setIsOnline(true);
    const handleOffline = () => // eslint-disable-next-line react-hooks/set-state-in-effect -- Offline status handler
      setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Hook to check if a specific capability is supported
 */
export function useCapability<K extends keyof Capabilities>(
  capability: K
): boolean {
  const capabilities = useCapabilities();
  return capabilities[capability];
}

/**
 * Hook for PWA install prompt
 */
export function usePWAInstall(): {
  isInstallable: boolean;
  installPrompt: BeforeInstallPromptEvent | null;
  install: () => Promise<void>;
  dismiss: () => void;
} {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstallable(false);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) return;

    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstallable(false);
      setInstallPrompt(null);
    }
  }, [installPrompt]);

  const dismiss = useCallback(() => {
    setIsInstallable(false);
  }, []);

  return { isInstallable, installPrompt, install, dismiss };
}

/**
 * Hook for screen orientation
 */
export function useOrientation(): {
  orientation: OrientationType | null;
  angle: number;
  isPortrait: boolean;
  isLandscape: boolean;
} {
  const [orientation, setOrientation] = useState<OrientationType | null>(null);
  const [angle, setAngle] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.screen?.orientation) return;

    const updateOrientation = () => {
      if (window.screen.orientation) {
        setOrientation(window.screen.orientation.type);
        setAngle(window.screen.orientation.angle || 0);
      }
    };

    updateOrientation();
    window.screen.orientation?.addEventListener("change", updateOrientation);

    return () => {
      window.screen.orientation?.removeEventListener("change", updateOrientation);
    };
  }, []);

  return {
    orientation,
    angle,
    isPortrait: !orientation || orientation.includes("portrait"),
    isLandscape: orientation?.includes("landscape") ?? false,
  };
}

/**
 * Hook for battery status
 */
export function useBattery(): {
  supported: boolean;
  charging: boolean;
  level: number;
  chargingTime: number;
  dischargingTime: number;
} {
  const [battery, setBattery] = useState({
    supported: false,
    charging: false,
    level: 1,
    chargingTime: 0,
    dischargingTime: Infinity,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const getBattery = async () => {
      const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
      if (!nav.getBattery) {
        setBattery((prev) => ({ ...prev, supported: false }));
        return;
      }

      try {
        const batteryManager = await nav.getBattery();
        setBattery({
          supported: true,
          charging: batteryManager.charging,
          level: batteryManager.level,
          chargingTime: batteryManager.chargingTime,
          dischargingTime: batteryManager.dischargingTime,
        });

        const updateBattery = () => {
          setBattery({
            supported: true,
            charging: batteryManager.charging,
            level: batteryManager.level,
            chargingTime: batteryManager.chargingTime,
            dischargingTime: batteryManager.dischargingTime,
          });
        };

        batteryManager.addEventListener("chargingchange", updateBattery);
        batteryManager.addEventListener("levelchange", updateBattery);
      } catch {
        setBattery((prev) => ({ ...prev, supported: false }));
      }
    };

    getBattery();
  }, []);

  return battery;
}

/**
 * Hook for connection information
 */
export function useConnection(): {
  supported: boolean;
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
} {
  const [connection, setConnection] = useState({
    supported: false,
    effectiveType: "unknown",
    downlink: 0,
    rtt: 0,
    saveData: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const nav = navigator as Navigator & { connection?: NetworkInformation };
    const connectionInfo = nav.connection;

    if (!connectionInfo) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Network info initialization
    setConnection({
      supported: true,
      effectiveType: connectionInfo.effectiveType || "unknown",
      downlink: connectionInfo.downlink || 0,
      rtt: connectionInfo.rtt || 0,
      saveData: connectionInfo.saveData || false,
    });

    const updateConnection = () => {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Network info update handler
      setConnection({
        supported: true,
        effectiveType: connectionInfo.effectiveType || "unknown",
        downlink: connectionInfo.downlink || 0,
        rtt: connectionInfo.rtt || 0,
        saveData: connectionInfo.saveData || false,
      });
    };

    connectionInfo.addEventListener("change", updateConnection);

    return () => {
      connectionInfo.removeEventListener("change", updateConnection);
    };
  }, []);

  return connection;
}

// Type definitions for extended APIs
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

interface NetworkInformation extends EventTarget {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

interface Navigator {
  getBattery?: () => Promise<BatteryManager>;
  connection?: NetworkInformation;
}
