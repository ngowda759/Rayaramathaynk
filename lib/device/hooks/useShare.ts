"use client";

/**
 * useShare Hook
 * React hook for native sharing functionality
 */

import { useState, useCallback } from "react";
import { shareService } from "../share";
import { useCapability } from "./useDevice";
import type { ShareData, ShareProvider, ShareOptions } from "@/types/device";

interface UseShareReturn {
  // State
  isSupported: boolean;
  isSharing: boolean;
  lastShareProvider: ShareProvider | null;
  
  // Actions
  share: (data: ShareData, options?: ShareOptions) => Promise<boolean>;
  shareVia: (provider: ShareProvider, data: ShareData) => void;
  copyToClipboard: (text: string) => Promise<boolean>;
  generateShareText: (template: string, data: Record<string, string>) => string;
  
  // Available providers
  availableProviders: ShareProvider[];
}

export function useShare(): UseShareReturn {
  const nativeShareSupported = useCapability("shareSupported");
  const [isSharing, setIsSharing] = useState(false);
  const [lastShareProvider, setLastShareProvider] = useState<ShareProvider | null>(null);

  const share = useCallback(async (
    data: ShareData,
    options: ShareOptions = {}
  ): Promise<boolean> => {
    setIsSharing(true);
    
    try {
      // Try native share
      if (nativeShareSupported) {
        const success = await shareService.shareNative(data);
        if (success) {
          setLastShareProvider("native");
          setIsSharing(false);
          return true;
        }
      }

      // Fallback: copy URL
      if (data.url) {
        const copied = await shareService.copyToClipboard(data.url);
        if (copied) {
          setLastShareProvider("copy");
          options.onCopySuccess?.();
          setIsSharing(false);
          return true;
        }
        options.onCopyError?.();
      }

      setIsSharing(false);
      return false;
    } catch {
      setIsSharing(false);
      return false;
    }
  }, [nativeShareSupported]);

  const shareVia = useCallback((
    provider: ShareProvider,
    data: ShareData
  ) => {
    shareService.shareVia(provider, data);
    setLastShareProvider(provider);
  }, []);

  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    return shareService.copyToClipboard(text);
  }, []);

  const generateShareText = useCallback((
    template: string,
    data: Record<string, string>
  ): string => {
    return shareService.generateShareText(template, data);
  }, []);

  return {
    isSupported: nativeShareSupported,
    isSharing,
    lastShareProvider,
    share,
    shareVia,
    copyToClipboard,
    generateShareText,
    availableProviders: shareService.getAvailableProviders(),
  };
}

/**
 * useShareContent Hook
 * Hook for sharing specific content types
 */
interface ShareContentOptions {
  title?: string;
  text?: string;
  url?: string;
  template?: string;
  templateData?: Record<string, string>;
}

interface UseShareContentReturn {
  // Computed values
  shareText: string;
  shareUrl: string;
  
  // Actions
  share: (options?: ShareOptions) => Promise<boolean>;
  shareVia: (provider: ShareProvider, options?: ShareOptions) => void;
  
  // Individual provider shares
  shareViaWhatsApp: (options?: ShareOptions) => void;
  shareViaFacebook: (options?: ShareOptions) => void;
  shareViaTwitter: (options?: ShareOptions) => void;
  shareViaLinkedIn: (options?: ShareOptions) => void;
  shareViaTelegram: (options?: ShareOptions) => void;
  shareViaEmail: (options?: ShareOptions) => void;
  copyLink: () => Promise<boolean>;
}

export function useShareContent(
  type: "event" | "seva" | "gallery" | "donation" | "quote" | "panchanga",
  content: ShareContentOptions,
  templates?: Record<string, string>
): UseShareContentReturn {
  const { share, shareVia, copyToClipboard, generateShareText, isSupported } = useShare();
  const [isSharing, setIsSharing] = useState(false);

  // Default templates
  const defaultTemplates: Record<string, string> = {
    event: "Join us for {title} at Sri Raghavendra Swamy Matha! {date}",
    seva: "Booked {title} at Sri Raghavendra Swamy Matha - {date}",
    gallery: "Beautiful moments from Sri Raghavendra Swamy Matha!",
    donation: "Support Sri Raghavendra Swamy Matha's divine services. {url}",
    quote: '"{quote}" - Sri Raghavendra Swamy Matha',
    panchanga: "Today's Panchanga from Sri Raghavendra Swamy Matha: {summary}",
  };

  const template = templates?.[type] || defaultTemplates[type] || "{title}";
  
  // Generate share text
  const shareText = generateShareText(template, {
    ...content.templateData,
    title: content.title || "",
    date: content.text || "",
    url: content.url || "",
    summary: content.text || "",
    quote: content.text || "",
  });

  const shareUrl = content.url || (typeof window !== "undefined" ? window.location.href : "");

  const handleShare = async (options?: ShareOptions): Promise<boolean> => {
    setIsSharing(true);
    try {
      const result = await share({
        title: content.title,
        text: shareText,
        url: shareUrl,
      }, options);
      return result;
    } finally {
      setIsSharing(false);
    }
  };

  const handleShareVia = (provider: ShareProvider, options?: ShareOptions) => {
    setIsSharing(true);
    shareVia(provider, {
      title: content.title,
      text: shareText,
      url: shareUrl,
    });
    setIsSharing(false);
  };

  return {
    shareText,
    shareUrl,
    share: handleShare,
    shareVia: handleShareVia,
    shareViaWhatsApp: (options) => handleShareVia("whatsapp", options),
    shareViaFacebook: (options) => handleShareVia("facebook", options),
    shareViaTwitter: (options) => handleShareVia("twitter", options),
    shareViaLinkedIn: (options) => handleShareVia("linkedin", options),
    shareViaTelegram: (options) => handleShareVia("telegram", options),
    shareViaEmail: (options) => handleShareVia("email", options),
    copyLink: () => copyToClipboard(shareUrl),
  };
}
