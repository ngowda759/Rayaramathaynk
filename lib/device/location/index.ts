/**
 * Location Service
 * GPS/Location services with temple distance calculation and navigation
 */

import type { Coordinates, LocationPosition, TempleLocation } from "@/types/device";
import { DEFAULT_DEVICE_SETTINGS } from "@/types/device";

export interface LocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

class LocationService {
  private watchId: number | null = null;
  private templeLocation: TempleLocation = DEFAULT_DEVICE_SETTINGS.templeLocation;

  /**
   * Set temple location from settings
   */
  setTempleLocation(location: TempleLocation): void {
    this.templeLocation = location;
  }

  /**
   * Get current temple location
   */
  getTempleLocation(): TempleLocation {
    return { ...this.templeLocation };
  }

  /**
   * Check if geolocation is supported
   */
  isSupported(): boolean {
    if (typeof window === "undefined") return false;
    return "geolocation" in window.navigator;
  }

  /**
   * Get current position
   */
  getCurrentPosition(options?: LocationOptions): Promise<LocationPosition> {
    return new Promise((resolve, reject) => {
      if (!this.isSupported()) {
        reject(new Error("Geolocation not supported"));
        return;
      }

      const defaultOptions: PositionOptions = {
        enableHighAccuracy: options?.enableHighAccuracy ?? false,
        timeout: options?.timeout ?? 10000,
        maximumAge: options?.maximumAge ?? 0,
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve(this.positionToLocationPosition(position));
        },
        (error) => {
          reject(new Error(this.getErrorMessage(error.code)));
        },
        defaultOptions
      );
    });
  }

  /**
   * Watch position
   */
  watchPosition(
    onUpdate: (position: LocationPosition) => void,
    onError?: (error: string) => void,
    options?: LocationOptions
  ): number {
    if (!this.isSupported()) {
      onError?.("Geolocation not supported");
      return -1;
    }

    const defaultOptions: PositionOptions = {
      enableHighAccuracy: options?.enableHighAccuracy ?? false,
      timeout: options?.timeout ?? 10000,
      maximumAge: options?.maximumAge ?? 5000,
    };

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        onUpdate(this.positionToLocationPosition(position));
      },
      (error) => {
        onError?.(this.getErrorMessage(error.code));
      },
      defaultOptions
    );

    return this.watchId;
  }

  /**
   * Clear watch
   */
  clearWatch(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(from: Coordinates, to: Coordinates): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(to.latitude - from.latitude);
    const dLon = this.toRadians(to.longitude - from.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(from.latitude)) *
        Math.cos(this.toRadians(to.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }

  /**
   * Calculate distance to temple
   */
  distanceToTemple(position: Coordinates): number {
    return this.calculateDistance(position, this.templeLocation);
  }

  /**
   * Format distance for display
   */
  formatDistance(distanceKm: number): string {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)} m`;
    }
    return `${distanceKm.toFixed(1)} km`;
  }

  /**
   * Calculate ETA based on average speed
   */
  calculateETA(distanceKm: number, speedKmh: number = 40): number {
    // Returns ETA in minutes
    return Math.round((distanceKm / speedKmh) * 60);
  }

  /**
   * Format ETA for display
   */
  formatETA(minutes: number): string {
    if (minutes < 1) {
      return "< 1 min";
    }
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  /**
   * Open Google Maps
   */
  openGoogleMaps(destination?: Coordinates): void {
    const coords = destination || this.templeLocation;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${coords.latitude},${coords.longitude}`;
    window.open(url, "_blank");
  }

  /**
   * Open Apple Maps (for iOS/macOS)
   */
  openAppleMaps(destination?: Coordinates): void {
    const coords = destination || this.templeLocation;
    const url = `https://maps.apple.com/?daddr=${coords.latitude},${coords.longitude}`;
    window.open(url, "_blank");
  }

  /**
   * Open Waze
   */
  openWaze(destination?: Coordinates): void {
    const coords = destination || this.templeLocation;
    const url = `https://waze.com/ul?ll=${coords.latitude},${coords.longitude}&navigate=yes`;
    window.open(url, "_blank");
  }

  /**
   * Open navigation with preferred app
   */
  openNavigation(
    app: "google" | "apple" | "waze" | "any" = "google",
    destination?: Coordinates
  ): void {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);

    switch (app) {
      case "google":
        this.openGoogleMaps(destination);
        break;
      case "apple":
        this.openAppleMaps(destination);
        break;
      case "waze":
        this.openWaze(destination);
        break;
      case "any":
      default:
        // Auto-select based on platform
        if (isIOS) {
          this.openAppleMaps(destination);
        } else if (isAndroid) {
          this.openGoogleMaps(destination);
        } else {
          this.openGoogleMaps(destination);
        }
        break;
    }
  }

  /**
   * Generate shareable location URL
   */
  getLocationUrl(destination?: Coordinates): string {
    const coords = destination || this.templeLocation;
    return `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
  }

  /**
   * Generate directions URL for embedding
   */
  getDirectionsUrl(
    origin: Coordinates,
    destination?: Coordinates
  ): string {
    const dest = destination || this.templeLocation;
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${dest.latitude},${dest.longitude}`;
  }

  /**
   * Convert GeolocationPosition to LocationPosition
   */
  private positionToLocationPosition(position: GeolocationPosition): LocationPosition {
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      altitudeAccuracy: position.coords.altitudeAccuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
      timestamp: position.timestamp,
    };
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get error message from error code
   */
  private getErrorMessage(code: number): string {
    switch (code) {
      case 1:
        return "Location permission denied";
      case 2:
        return "Location unavailable";
      case 3:
        return "Location request timed out";
      default:
        return "Unknown location error";
    }
  }
}

// Singleton instance
export const locationService = new LocationService();
