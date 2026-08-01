"use client";

/**
 * QR Code Generation and Display Component
 * Generates QR codes for bookings, donations, events, and volunteer check-in
 */

import { useState, useEffect } from "react";
import {
  QrCode,
  Download,
  Share2,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import { useShare } from "@/lib/device";
import { cn } from "@/lib/utils";

export type QRCodeType = 
  | "seva-booking"
  | "donation-receipt"
  | "event-registration"
  | "volunteer-checkin"
  | "digital-pass"
  | "public-page"
  | "testimonials-submit";

export interface QRCodeData {
  type: QRCodeType;
  id: string;
  title?: string;
  date?: string;
  [key: string]: string | undefined;
}

interface QRCodeGeneratorProps {
  data: QRCodeData;
  size?: number;
  showActions?: boolean;
  className?: string;
}

interface QRCodeGeneratorReturn {
  qrDataUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

// Generate QR code data URL (client-side)
async function generateQRCodeDataUrl(
  text: string,
  size: number = 200
): Promise<string> {
  // Use a QR code generation library dynamically
  // This will be loaded client-side only
  if (typeof window === "undefined") {
    throw new Error("QR code generation requires client-side rendering");
  }

  // Dynamic import of QRCode library
  const QRCode = (await import("qrcode")).default;
  
  const dataUrl = await QRCode.toDataURL(text, {
    width: size,
    margin: 2,
    color: {
      dark: "#1c1917", // stone-900
      light: "#ffffff",
    },
  });
  
  return dataUrl;
}

// Generate unique ID for QR code
function generateQRId(type: QRCodeType, id: string): string {
  return `RAYAMATHA:${type.toUpperCase()}:${id}`;
}

// Create QR code payload
function createQRPayload(data: QRCodeData): string {
  const payload = {
    type: data.type,
    id: data.id,
    title: data.title,
    date: data.date || new Date().toISOString().split("T")[0],
  };
  return JSON.stringify(payload);
}

export function useQRCodeGenerator(data: QRCodeData, size: number = 200) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function generateQR() {
      if (!data.id) {
        setError("Missing ID for QR code");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const payload = createQRPayload(data);
        const qrId = generateQRId(data.type, data.id);
        const dataUrl = await generateQRCodeDataUrl(qrId, size);
        setQrDataUrl(dataUrl);
      } catch (err) {
        console.error("QR generation error:", err);
        setError("Failed to generate QR code");
      } finally {
        setIsLoading(false);
      }
    }

    generateQR();
  }, [data, size]);

  return { qrDataUrl, isLoading, error };
}

/**
 * QR Code Display Component
 */
export function QRCodeDisplay({
  data,
  size = 200,
  showActions = true,
  className,
}: QRCodeGeneratorProps) {
  const { qrDataUrl, isLoading, error } = useQRCodeGenerator(data, size);
  const share = useShare();
  const [copied, setCopied] = useState(false);

  // Download QR code
  const handleDownload = () => {
    if (!qrDataUrl) return;

    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `${data.type}-${data.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("QR code downloaded");
  };

  // Share QR code
  const handleShare = async () => {
    if (!qrDataUrl) return;

    // Convert data URL to blob for sharing
    const response = await fetch(qrDataUrl);
    const blob = await response.blob();
    const file = new File([blob], `${data.type}-${data.id}.png`, {
      type: "image/png",
    });

    const success = await share.share({
      title: data.title || "QR Code",
      text: `QR Code for ${data.type.replace(/-/g, " ")}`,
      files: [file],
    });

    if (success) {
      toast.success("QR code has been shared");
    }
  };

  // Copy QR code link
  const handleCopyLink = async () => {
    const qrId = generateQRId(data.type, data.id);
    await share.copyToClipboard(qrId);
    setCopied(true);
    toast.success("QR code data copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className={cn("flex flex-col items-center gap-4", className)}>
        <div className="flex h-[200px] w-[200px] items-center justify-center rounded-lg border border-stone-200 bg-stone-50">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
        {showActions && (
          <p className="text-sm text-stone-500">Generating QR code...</p>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center gap-4", className)}>
        <div className="flex h-[200px] w-[200px] items-center justify-center rounded-lg border border-stone-200 bg-stone-50">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/* QR Code Image */}
      <div className="relative overflow-hidden rounded-lg border-4 border-stone-200 bg-white p-4 shadow-lg">
        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt={`QR Code for ${data.title || data.type}`}
            width={size}
            height={size}
            className="h-full w-full"
          />
        )}
      </div>

      {/* Type Label */}
      <div className="text-center">
        <p className="font-medium text-stone-900 capitalize">
          {data.title || data.type.replace(/-/g, " ")}
        </p>
        <p className="text-xs text-stone-500">ID: {data.id}</p>
      </div>

      {/* Action Buttons */}
      {showActions && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            {copied ? (
              <Check className="mr-2 h-4 w-4 text-green-600" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Compact QR Code for inline display
 */
interface CompactQRCodeProps {
  data: QRCodeData;
  size?: number;
  className?: string;
}

export function CompactQRCode({
  data,
  size = 100,
  className,
}: CompactQRCodeProps) {
  const { qrDataUrl, isLoading } = useQRCodeGenerator(data, size);

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex h-[100px] w-[100px] items-center justify-center rounded-lg border border-stone-200 bg-stone-50",
          className
        )}
      >
        <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border-2 border-stone-200 bg-white p-2",
        className
      )}
    >
      {qrDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrDataUrl}
          alt={`QR Code for ${data.title || data.type}`}
          width={size}
          height={size}
          className="h-full w-full"
        />
      )}
    </div>
  );
}

/**
 * QR Code Scanner Result Display
 * Shows the result of a scanned QR code
 */
interface QRScannerResultProps {
  result: string;
  onClose?: () => void;
}

export function QRScannerResult({ result, onClose }: QRScannerResultProps) {
  const share = useShare();
  const [copied, setCopied] = useState(false);

  // Parse QR code data
  const parseQRData = (data: string): { isValid: boolean; data?: QRCodeData; raw?: string } => {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(data);
      if (parsed.type && parsed.id) {
        return { isValid: true, data: parsed as QRCodeData };
      }
    } catch {
      // Check for rayamat ha format
      if (data.startsWith("RAYAMATHA:")) {
        const parts = data.split(":");
        if (parts.length >= 3) {
          return {
            isValid: true,
            data: {
              type: parts[1].toLowerCase() as QRCodeType,
              id: parts[2],
            },
            raw: data,
          };
        }
      }
    }
    return { isValid: false, raw: data };
  };

  const parsed = parseQRData(result);

  const handleCopy = async () => {
    await share.copyToClipboard(result);
    setCopied(true);
    toast.success("QR code data copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-stone-900">
            {parsed.isValid ? "Valid Temple QR Code" : "QR Code Data"}
          </p>
          <p className="mt-1 font-mono text-sm text-stone-600 break-all">
            {result}
          </p>
          {parsed.data && (
            <div className="mt-2 flex gap-2">
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 capitalize">
                {parsed.data.type.replace(/-/g, " ")}
              </span>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                ID: {parsed.data.id}
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Export helper functions
export { generateQRId, createQRPayload };

// URL-based QR code generation for public pages
// These generate simple URL QR codes (not the complex payload format)

export interface URLQRCodeData {
  type: "public-page" | "testimonials-submit";
  url: string;
  title: string;
  description?: string;
}

export async function generateURLQRCodeDataUrl(
  url: string,
  size: number = 300
): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("QR code generation requires client-side rendering");
  }

  const QRCode = (await import("qrcode")).default;
  
  const dataUrl = await QRCode.toDataURL(url, {
    width: size,
    margin: 2,
    color: {
      dark: "#1c1917", // stone-900
      light: "#ffffff",
    },
  });
  
  return dataUrl;
}

export function useURLQRCodeGenerator(data: URLQRCodeData, size: number = 300) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function generateQR() {
      if (!data.url) {
        setError("Missing URL for QR code");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const urlDataUrl = await generateURLQRCodeDataUrl(data.url, size);
        setQrDataUrl(urlDataUrl);
      } catch (err) {
        console.error("QR generation error:", err);
        setError("Failed to generate QR code");
      } finally {
        setIsLoading(false);
      }
    }

    generateQR();
  }, [data.url, size]);

  return { qrDataUrl, isLoading, error };
}
