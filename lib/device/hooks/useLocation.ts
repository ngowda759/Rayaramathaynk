"use client";

/**
 * useLocation Hook
 * React hook for GPS/Location functionality
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { locationService } from "../location";
import type { Coordinates, LocationPosition, TempleLocation } from "@/types/device";
import { useLocationPermission } from "./usePermissions";

interface UseLocationOptions {
  enableHighAccuracy?: boolean;
  watchPosition?: boolean;
  templeLocation?: TempleLocation;
}

interface UseLocationReturn {
  // Position
  current: LocationPosition | null;
  coordinates: Coordinates | null;
  
  // Distance to temple
  distanceToTemple: number | null;
  formattedDistance: string;
  
  // ETA
  eta: number | null;
  formattedETA: string;
  
  // Temple info
  templeLocation: TempleLocation;
  
  // State
  isLoading: boolean;
  error: string | null;
  isWatching: boolean;
  hasLocation: boolean;
  
  // Actions
  getCurrentLocation: () => Promise<LocationPosition | null>;
  startWatching: () => void;
  stopWatching: () => void;
  refresh: () => Promise<LocationPosition | null>;
  
  // Navigation
  openGoogleMaps: () => void;
  openAppleMaps: () => void;
  openWaze: () => void;
  openNavigation: (app?: "google" | "apple" | "waze" | "any") => void;
  getLocationUrl: () => string;
  getDirectionsUrl: () => string;
  
  // Permission
  permission: ReturnType<typeof useLocationPermission>;
}

export function useLocation(options: UseLocationOptions = {}): UseLocationReturn {
  const {
    enableHighAccuracy = false,
    watchPosition: shouldWatch = false,
    templeLocation: customTempleLocation,
  } = options;

  // Permission hook
  const permission = useLocationPermission();

  // Temple location (can be customized)
  const [templeLocation, setTempleLocation] = useState<TempleLocation>(() => {
    return customTempleLocation || locationService.getTempleLocation();
  });

  // Position state
  const [current, setCurrent] = useState<LocationPosition | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);

  // Refs
  const watchIdRef = useRef<number | null>(null);

  // Update temple location
  useEffect(() => {
    if (customTempleLocation) {
      locationService.setTempleLocation(customTempleLocation);
      setTempleLocation(customTempleLocation);
    }
  }, [customTempleLocation]);

  // Calculate distance to temple
  const distanceToTemple = current
    ? locationService.distanceToTemple(current)
    : null;

  const formattedDistance = distanceToTemple !== null
    ? locationService.formatDistance(distanceToTemple)
    : "";

  // Calculate ETA
  const eta = distanceToTemple !== null
    ? locationService.calculateETA(distanceToTemple)
    : null;

  const formattedETA = eta !== null
    ? locationService.formatETA(eta)
    : "";

  // Get current location
  const getCurrentLocation = useCallback(async (): Promise<LocationPosition | null> => {
    if (permission.isDenied) {
      setError("Location permission denied");
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Request permission if needed
      if (permission.isPrompt) {
        const result = await permission.request();
        if (result.state !== "granted") {
          throw new Error("Location permission not granted");
        }
      }

      const position = await locationService.getCurrentPosition({
        enableHighAccuracy,
      });

      setCurrent(position);
      return position;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to get location";
      setError(errorMsg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [permission, enableHighAccuracy]);

  // Start watching position
  const startWatching = useCallback(() => {
    if (isWatching) return;

    if (permission.isDenied) {
      setError("Location permission denied");
      return;
    }

    setError(null);

    watchIdRef.current = locationService.watchPosition(
      (position) => {
        setCurrent(position);
        setError(null);
      },
      (errorMsg) => {
        setError(errorMsg);
      },
      { enableHighAccuracy }
    );

    setIsWatching(true);
  }, [permission, isWatching, enableHighAccuracy]);

  // Stop watching position
  const stopWatching = useCallback(() => {
    locationService.clearWatch();
    watchIdRef.current = null;
    setIsWatching(false);
  }, []);

  // Refresh location
  const refresh = useCallback(async (): Promise<LocationPosition | null> => {
    return getCurrentLocation();
  }, [getCurrentLocation]);

  // Auto-watch if option enabled
  useEffect(() => {
    if (shouldWatch && !isWatching && !permission.isDenied) {
      startWatching();
    }

    return () => {
      if (shouldWatch && isWatching) {
        stopWatching();
      }
    };
  }, [shouldWatch, isWatching, permission.isDenied, startWatching, stopWatching]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        locationService.clearWatch();
      }
    };
  }, []);

  // Navigation functions
  const openGoogleMaps = useCallback(() => {
    locationService.openGoogleMaps();
  }, []);

  const openAppleMaps = useCallback(() => {
    locationService.openAppleMaps();
  }, []);

  const openWaze = useCallback(() => {
    locationService.openWaze();
  }, []);

  const openNavigation = useCallback((app: "google" | "apple" | "waze" | "any" = "any") => {
    locationService.openNavigation(app);
  }, []);

  const getLocationUrl = useCallback(() => {
    return locationService.getLocationUrl();
  }, []);

  const getDirectionsUrl = useCallback(() => {
    if (current) {
      return locationService.getDirectionsUrl(current);
    }
    return locationService.getLocationUrl();
  }, [current]);

  return {
    // Position
    current,
    coordinates: current
      ? { latitude: current.latitude, longitude: current.longitude }
      : null,

    // Distance
    distanceToTemple,
    formattedDistance,

    // ETA
    eta,
    formattedETA,

    // Temple info
    templeLocation,

    // State
    isLoading,
    error,
    isWatching,
    hasLocation: current !== null,

    // Actions
    getCurrentLocation,
    startWatching,
    stopWatching,
    refresh,

    // Navigation
    openGoogleMaps,
    openAppleMaps,
    openWaze,
    openNavigation,
    getLocationUrl,
    getDirectionsUrl,

    // Permission
    permission,
  };
}

/**
 * useTempleDistance Hook
 * Simplified hook for just distance calculation
 */
export function useTempleDistance() {
  const location = useLocation();
  
  return {
    distance: location.distanceToTemple,
    formattedDistance: location.formattedDistance,
    eta: location.eta,
    formattedETA: location.formattedETA,
    templeLocation: location.templeLocation,
    isLoading: location.isLoading,
    error: location.error,
    getLocation: location.getCurrentLocation,
  };
}
