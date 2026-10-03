/**
 * QR Scanner Service
 * Camera-based QR code scanning using html5-qrcode library
 */

import type { QRCodeResult, CameraDirection, QRScannerState } from "@/types/device";

 
type Html5QrcodeConstructor = any;

export interface QRScannerCallbacks {
  onScan: (result: QRCodeResult) => void;
  onError?: (error: string) => void;
  onCameraChange?: (camera: CameraDirection) => void;
}

interface Html5Qrcode {
  start: (cameraId: string, config: Record<string, unknown>, onScan: (decodedText: string) => void, onError?: (errorMessage: string) => void) => Promise<void>;
  stop: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  clear: () => void;
  getRunningTrackCapabilities?: () => MediaTrackCapabilities;
  getRunningTrackSettings?: () => MediaTrackSettings;
  applyVideoConstraints?: (constraints: MediaTrackConstraints) => Promise<void>;
  getCameras: () => Promise<Array<{ id: string; label: string }>>;
  scanFile: (file: File, shouldRotate: boolean) => Promise<string>;
}

declare global {
  interface Window {
    Html5Qrcode: Html5QrcodeConstructor;
  }
}

class QRScannerService {
  private scanner: Html5Qrcode | null = null;
  private callbacks: QRScannerCallbacks | null = null;
  private state: QRScannerState = {
    isScanning: false,
    isPaused: false,
    cameraDirection: "environment",
    hasTorch: false,
    torchEnabled: false,
    error: null,
    lastResult: null,
  };
  private currentCameraId: string | null = null;
  private cameras: Array<{ id: string; label: string }> = [];
  private currentCameraIndex: number = 0;

  /**
   * Check if html5-qrcode library is loaded
   */
  isLibraryLoaded(): boolean {
    return typeof window !== "undefined" && "Html5Qrcode" in window;
  }

  /**
   * Load the html5-qrcode library dynamically
   */
  async loadLibrary(): Promise<boolean> {
    if (this.isLibraryLoaded()) return true;

    return new Promise((resolve) => {
      // Check if script is already loading
      if (document.querySelector('script[src*="html5-qrcode"]')) {
        const checkLoaded = setInterval(() => {
          if (this.isLibraryLoaded()) {
            clearInterval(checkLoaded);
            resolve(true);
          }
        }, 100);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  /**
   * Get available cameras
   */
  async getCameras(): Promise<Array<{ id: string; label: string }>> {
    if (!this.isLibraryLoaded()) {
      await this.loadLibrary();
    }

    if (!window.Html5Qrcode) {
      throw new Error("QR Scanner library not loaded");
    }

    const html5QrCode = new window.Html5Qrcode("qr-reader-placeholder");
    const cameras = await html5QrCode.getCameras();
    this.cameras = cameras;
    return cameras;
  }

  /**
   * Start scanning with a specific camera
   */
  async start(
    elementId: string,
    callbacks: QRScannerCallbacks,
    options: { cameraDirection?: CameraDirection; continuous?: boolean } = {}
  ): Promise<void> {
    if (this.state.isScanning) {
      await this.stop();
    }

    // Load library if needed
    if (!this.isLibraryLoaded()) {
      const loaded = await this.loadLibrary();
      if (!loaded) {
        callbacks.onError?.("Failed to load QR scanner library");
        return;
      }
    }

    if (!window.Html5Qrcode) {
      callbacks.onError?.("QR Scanner library not available");
      return;
    }

    this.callbacks = callbacks;
    this.state.cameraDirection = options.cameraDirection || "environment";

    try {
      // Get available cameras
      const html5QrCode = new window.Html5Qrcode(elementId);
      this.scanner = html5QrCode;

      let cameras = this.cameras;
      if (cameras.length === 0) {
        cameras = await html5QrCode.getCameras();
        this.cameras = cameras;
      }

      if (cameras.length === 0) {
        throw new Error("No cameras found");
      }

      // Find the camera matching the desired direction
      const desiredCamera = this.findCameraByDirection(cameras, this.state.cameraDirection);
      this.currentCameraId = desiredCamera?.id || cameras[0].id;
      this.currentCameraIndex = cameras.findIndex(c => c.id === this.currentCameraId);

      // Configure scanning
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      // Start scanning
      await html5QrCode.start(
        this.currentCameraId,
        config,
        (decodedText: string) => {
          const result: QRCodeResult = {
            text: decodedText,
            timestamp: Date.now(),
          };
          this.state.lastResult = result;
          callbacks.onScan(result);
        },
        (errorMessage: string) => {
          // Ignore scan errors (usually just "no QR code found")
        }
      );

      this.state.isScanning = true;
      this.state.isPaused = false;
      this.state.error = null;

      // Check for torch capability
      await this.checkTorchCapability();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to start scanner";
      this.state.error = errorMessage;
      callbacks.onError?.(errorMessage);
    }
  }

  /**
   * Find a camera by direction (front/back)
   */
  private findCameraByDirection(
    cameras: Array<{ id: string; label: string }>,
    direction: CameraDirection
  ): { id: string; label: string } | undefined {
    const targetLabel = direction === "user" ? "front" : "back";
    
    // Look for camera with matching label
    const match = cameras.find(c => 
      c.label.toLowerCase().includes(targetLabel)
    );
    
    return match || cameras[0];
  }

  /**
   * Stop scanning
   */
  async stop(): Promise<void> {
    if (this.scanner && this.state.isScanning) {
      try {
        await this.scanner.stop();
      } catch {
        // Ignore stop errors
      }
    }

    this.scanner = null;
    this.state.isScanning = false;
    this.state.isPaused = false;
    this.state.torchEnabled = false;
  }

  /**
   * Pause scanning
   */
  pause(): void {
    if (this.scanner && this.state.isScanning && !this.state.isPaused) {
      this.scanner.pause();
      this.state.isPaused = true;
    }
  }

  /**
   * Resume scanning
   */
  resume(): void {
    if (this.scanner && this.state.isScanning && this.state.isPaused) {
      this.scanner.resume();
      this.state.isPaused = false;
    }
  }

  /**
   * Switch to next available camera
   */
  async switchCamera(): Promise<void> {
    if (!this.scanner || this.cameras.length <= 1) return;

    this.currentCameraIndex = (this.currentCameraIndex + 1) % this.cameras.length;
    const newCamera = this.cameras[this.currentCameraIndex];

    // Update direction based on camera
    this.state.cameraDirection = newCamera.label.toLowerCase().includes("front") 
      ? "user" 
      : "environment";

    // Restart with new camera
    const callbacks = this.callbacks;
    if (callbacks) {
      await this.stop();
      // Small delay to ensure camera is released
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.start("qr-reader", callbacks, {
        cameraDirection: this.state.cameraDirection,
      });
      this.callbacks?.onCameraChange?.(this.state.cameraDirection);
    }
  }

  /**
   * Toggle flashlight/torch
   */
  async toggleTorch(): Promise<boolean> {
    if (!this.scanner?.applyVideoConstraints) {
      return false;
    }

    try {
      const newTorchState = !this.state.torchEnabled;
      await this.scanner.applyVideoConstraints({
        // @ts-expect-error - advancedConstraints includes torch
        advanced: [{ torch: newTorchState }],
      } as MediaTrackConstraints);
      
      this.state.torchEnabled = newTorchState;
      this.state.hasTorch = true;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if camera supports torch
   */
  private async checkTorchCapability(): Promise<void> {
    if (this.scanner?.getRunningTrackCapabilities) {
      try {
        const capabilities = this.scanner.getRunningTrackCapabilities();
        this.state.hasTorch = "torch" in capabilities;
      } catch {
        this.state.hasTorch = false;
      }
    } else {
      this.state.hasTorch = false;
    }
  }

  /**
   * Get current scanner state
   */
  getState(): QRScannerState {
    return { ...this.state };
  }

  /**
   * Scan from image file
   */
  async scanFromImage(file: File): Promise<QRCodeResult | null> {
    if (!this.isLibraryLoaded()) {
      await this.loadLibrary();
    }

    if (!window.Html5Qrcode) {
      throw new Error("QR Scanner library not available");
    }

    const html5QrCode = new window.Html5Qrcode("qr-reader-placeholder");

    try {
      const result = await html5QrCode.scanFile(file, false);
      const qrResult: QRCodeResult = {
        text: result,
        timestamp: Date.now(),
      };
      this.state.lastResult = qrResult;
      return qrResult;
    } catch {
      return null;
    }
  }
}

// Singleton instance
export const qrScanner = new QRScannerService();
