"use client";

/**
 * QRScanner Component
 * Full-featured QR code scanner with camera access
 */

import { useState, useRef, useCallback } from "react";
import { useQRScanner } from "@/lib/device/hooks";
import { Camera, CameraOff, SwitchCamera, Flashlight, FlashlightOff, Upload, X, Check, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QRScannerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onScan?: (result: string) => void;
  continuous?: boolean;
  showControls?: boolean;
  elementId?: string;
}

export function QRScanner({
  open: controlledOpen,
  onOpenChange,
  onScan,
  continuous = true,
  showControls = true,
  elementId = "qr-reader",
}: QRScannerProps) {
  const [showResults, setShowResults] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scanner = useQRScanner({
    elementId,
    continuous,
    onScan: (result) => {
      onScan?.(result.text);
      if (!continuous) {
        setShowResults(true);
      }
    },
  });

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : manualOpen;

  const handleOpenChange = (newOpen: boolean) => {
    if (isControlled) {
      onOpenChange?.(newOpen);
    } else {
      setManualOpen(newOpen);
    }
  };

  const handleClose = () => {
    scanner.stop();
    handleOpenChange(false);
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await scanner.scanFromImage(file);
      if (result) {
        onScan?.(result.text);
        setShowResults(true);
      }
    } catch {
      // Handle error
    }
  }, [scanner, onScan]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              QR Code Scanner
            </DialogTitle>
            <DialogDescription>
              Point your camera at a QR code to scan
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {/* Scanner Container */}
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: "300px" }}>
              {/* Viewfinder */}
              <div id={elementId} className="w-full h-full" />

              {/* Loading State */}
              {scanner.isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                  <div className="text-center text-white">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p>Initializing camera...</p>
                  </div>
                </div>
              )}

              {/* Permission Error */}
              {scanner.permission.isDenied && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                  <div className="text-center text-white p-4">
                    <CameraOff className="h-12 w-12 mx-auto mb-3 text-red-400" />
                    <p className="font-semibold mb-2">Camera Access Denied</p>
                    <p className="text-sm text-gray-300 mb-4">
                      Please enable camera access in your browser settings
                    </p>
                    <Button variant="outline" onClick={handleClose}>
                      Close
                    </Button>
                  </div>
                </div>
              )}

              {/* Error State */}
              {scanner.error && !scanner.permission.isDenied && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                  <div className="text-center text-white p-4">
                    <AlertCircle className="h-12 w-12 mx-auto mb-3 text-yellow-400" />
                    <p className="font-semibold mb-2">Scanner Error</p>
                    <p className="text-sm text-gray-300 mb-4">{scanner.error}</p>
                    <Button variant="outline" onClick={scanner.start}>
                      Try Again
                    </Button>
                  </div>
                </div>
              )}

              {/* Controls Overlay */}
              {showControls && scanner.isScanning && !scanner.isLoading && (
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="flex items-center justify-center gap-2">
                    {/* Switch Camera */}
                    {scanner.availableCameras.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="bg-white/20 hover:bg-white/30 text-white rounded-full"
                        onClick={scanner.switchCamera}
                      >
                        <SwitchCamera className="h-5 w-5" />
                      </Button>
                    )}

                    {/* Torch Toggle */}
                    {scanner.hasTorch && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className={`rounded-full ${
                          scanner.torchEnabled ? "bg-yellow-500 hover:bg-yellow-600 text-black" : "bg-white/20 hover:bg-white/30 text-white"
                        }`}
                        onClick={scanner.toggleTorch}
                      >
                        {scanner.torchEnabled ? (
                          <Flashlight className="h-5 w-5" />
                        ) : (
                          <FlashlightOff className="h-5 w-5" />
                        )}
                      </Button>
                    )}

                    {/* Upload from Image */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="bg-white/20 hover:bg-white/30 text-white rounded-full"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-5 w-5" />
                    </Button>

                    {/* Pause/Resume */}
                    {continuous && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="bg-white/20 hover:bg-white/30 text-white rounded-full"
                        onClick={scanner.isPaused ? scanner.resume : scanner.pause}
                      >
                        {scanner.isPaused ? (
                          <Camera className="h-5 w-5" />
                        ) : (
                          <CameraOff className="h-5 w-5" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Scan Results */}
            {showResults && scanner.lastResult && (
              <Card className="mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    QR Code Scanned
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-sm bg-stone-50 p-2 rounded break-all">
                    {scanner.lastResult.text}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowResults(false)}
                    >
                      Scan Another
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(scanner.lastResult?.text || "");
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Not Started State */}
            {!scanner.isScanning && !scanner.isLoading && !scanner.error && (
              <div className="mt-4 text-center">
                <Button onClick={scanner.start} className="bg-orange-600 hover:bg-orange-700">
                  <Camera className="mr-2 h-4 w-4" />
                  Start Scanning
                </Button>
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * QRScannerButton Component
 * A button that opens the QR scanner dialog
 */
interface QRScannerButtonProps {
  children?: React.ReactNode;
  onScan?: (result: string) => void;
  variant?: "primary" | "outline" | "ghost";
  size?: "default" | "sm" | "icon" | "icon-sm";
  className?: string;
}

export function QRScannerButton({
  children,
  onScan,
  variant = "primary",
  size = "default",
  className = "",
}: QRScannerButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        {children || (
          <>
            <Camera className="mr-2 h-4 w-4" />
            Scan QR
          </>
        )}
      </Button>
      <QRScanner open={open} onOpenChange={setOpen} onScan={onScan} />
    </>
  );
}

/**
 * Compact QR Scanner for inline use
 */
interface CompactQRScannerProps {
  onScan: (result: string) => void;
  elementId?: string;
}

export function CompactQRScanner({ onScan, elementId = "qr-compact" }: CompactQRScannerProps) {
  const scanner = useQRScanner({
    elementId,
    continuous: false,
    onScan: (result) => onScan(result.text),
  });

  return (
    <div className="relative w-full max-w-sm mx-auto">
      <div
        id={elementId}
        className="w-full aspect-square bg-black rounded-lg overflow-hidden"
      />
      {!scanner.isScanning && !scanner.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-100 rounded-lg">
          <Button onClick={scanner.start} size="sm">
            <Camera className="mr-2 h-4 w-4" />
            Start Camera
          </Button>
        </div>
      )}
      {scanner.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-100 rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
        </div>
      )}
    </div>
  );
}
