"use client";

/**
 * useQRScanner Hook
 * React hook for QR code scanning functionality
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { qrScanner } from "../qr/scanner";
import type { QRCodeResult, QRScannerState, CameraDirection } from "@/types/device";
import { useCameraPermission } from "./usePermissions";
import { useCapability } from "./useDevice";

interface UseQRScannerOptions {
  continuous?: boolean;
  cameraDirection?: CameraDirection;
  elementId?: string;
  onScan?: (result: QRCodeResult) => void;
  onError?: (error: string) => void;
}

interface UseQRScannerReturn {
  // State
  isScanning: boolean;
  isPaused: boolean;
  isInitialized: boolean;
  cameraDirection: CameraDirection;
  hasTorch: boolean;
  torchEnabled: boolean;
  error: string | null;
  lastResult: QRCodeResult | null;
  availableCameras: Array<{ id: string; label: string }>;
  
  // Actions
  start: () => Promise<void>;
  stop: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  switchCamera: () => Promise<void>;
  toggleTorch: () => Promise<boolean>;
  scanFromImage: (file: File) => Promise<QRCodeResult | null>;
  
  // Permission
  permission: ReturnType<typeof useCameraPermission>;
  
  // Loading state
  isLoading: boolean;
  isLibraryLoaded: boolean;
}

export function useQRScanner(options: UseQRScannerOptions = {}): UseQRScannerReturn {
  const {
    continuous = true,
    cameraDirection = "environment",
    elementId = "qr-reader",
    onScan,
    onError,
  } = options;

  // Permission hook
  const permission = useCameraPermission();
  
  // Check if camera is supported
  const cameraSupported = useCapability("cameraSupported");

  // State
  const [isScanning, setIsScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentDirection, setCurrentDirection] = useState<CameraDirection>(cameraDirection);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<QRCodeResult | null>(null);
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);
  
  // Refs
  const elementIdRef = useRef(elementId);
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);

  // Update refs when props change
  useEffect(() => {
    elementIdRef.current = elementId;
    onScanRef.current = onScan;
    onErrorRef.current = onError;
  }, [elementId, onScan, onError]);

  // Load library on mount
  useEffect(() => {
    const loadLibrary = async () => {
      if (qrScanner.isLibraryLoaded()) {
        setIsLibraryLoaded(true);
        return;
      }

      setIsLoading(true);
      try {
        const loaded = await qrScanner.loadLibrary();
        setIsLibraryLoaded(loaded);
        if (!loaded) {
          setError("Failed to load QR scanner library");
        }
      } catch {
        setError("Failed to load QR scanner library");
      } finally {
        setIsLoading(false);
      }
    };

    loadLibrary();
  }, []);

  // Get available cameras when library is loaded
  useEffect(() => {
    const fetchCameras = async () => {
      if (!isLibraryLoaded || !cameraSupported) return;

      try {
        const cameras = await qrScanner.getCameras();
        setAvailableCameras(cameras);
      } catch {
        // Camera access may require permission
      }
    };

    fetchCameras();
  }, [isLibraryLoaded, cameraSupported]);

  // Start scanning
  const start = useCallback(async () => {
    if (!cameraSupported) {
      const errorMsg = "Camera not supported on this device";
      setError(errorMsg);
      onErrorRef.current?.(errorMsg);
      return;
    }

    if (permission.isDenied) {
      const errorMsg = "Camera permission denied";
      setError(errorMsg);
      onErrorRef.current?.(errorMsg);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Request permission if needed
      if (permission.isPrompt) {
        const result = await permission.request();
        if (result.state !== "granted") {
          throw new Error("Camera permission not granted");
        }
      }

      const callbacks = {
        onScan: (result: { text: string; timestamp: number }) => {
          setLastResult(result);
          onScanRef.current?.(result);
        },
        onError: (errorMsg: string) => {
          setError(errorMsg);
          onErrorRef.current?.(errorMsg);
        },
        onCameraChange: (camera: "environment" | "user") => {
          setCurrentDirection(camera);
        },
      };

      await qrScanner.start(elementIdRef.current, callbacks, {
        cameraDirection: currentDirection,
      });

      const state = qrScanner.getState();
      setIsScanning(state.isScanning);
      setIsPaused(state.isPaused);
      setHasTorch(state.hasTorch);
      setTorchEnabled(state.torchEnabled);
      setIsInitialized(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to start scanner";
      setError(errorMsg);
      onErrorRef.current?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [cameraSupported, permission, currentDirection]);

  // Stop scanning
  const stop = useCallback(async () => {
    try {
      await qrScanner.stop();
      setIsScanning(false);
      setIsPaused(false);
      setTorchEnabled(false);
    } catch {
      // Ignore stop errors
    }
  }, []);

  // Pause scanning
  const pause = useCallback(() => {
    qrScanner.pause();
    setIsPaused(true);
  }, []);

  // Resume scanning
  const resume = useCallback(() => {
    qrScanner.resume();
    setIsPaused(false);
  }, []);

  // Switch camera
  const switchCamera = useCallback(async () => {
    if (!isScanning) return;

    try {
      await qrScanner.switchCamera();
      const state = qrScanner.getState();
      setCurrentDirection(state.cameraDirection);
      setHasTorch(state.hasTorch);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to switch camera";
      setError(errorMsg);
    }
  }, [isScanning]);

  // Toggle torch
  const toggleTorch = useCallback(async (): Promise<boolean> => {
    if (!hasTorch || !isScanning) return false;

    try {
      const success = await qrScanner.toggleTorch();
      if (success) {
        setTorchEnabled(!torchEnabled);
      }
      return success;
    } catch {
      return false;
    }
  }, [hasTorch, isScanning, torchEnabled]);

  // Scan from image
  const scanFromImage = useCallback(async (file: File): Promise<QRCodeResult | null> => {
    try {
      const result = await qrScanner.scanFromImage(file);
      if (result) {
        setLastResult(result);
        onScanRef.current?.(result);
      }
      return result;
    } catch {
      return null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      qrScanner.stop().catch(() => {});
    };
  }, []);

  return {
    // State
    isScanning,
    isPaused,
    isInitialized,
    cameraDirection: currentDirection,
    hasTorch,
    torchEnabled,
    error,
    lastResult,
    availableCameras,
    
    // Actions
    start,
    stop,
    pause,
    resume,
    switchCamera,
    toggleTorch,
    scanFromImage,
    
    // Permission
    permission,
    
    // Loading
    isLoading,
    isLibraryLoaded,
  };
}
