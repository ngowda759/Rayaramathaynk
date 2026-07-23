/**
 * Share Service
 * Native share API with desktop fallbacks
 */

import type { ShareData, ShareProvider, ShareOptions } from "@/types/device";
import { isShareSupported } from "../capabilities";

class ShareService {
  /**
   * Check if native share is supported
   */
  isSupported(): boolean {
    return isShareSupported();
  }

  /**
   * Share using native Web Share API (mobile)
   */
  async shareNative(data: ShareData): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    try {
      await navigator.share(data);
      return true;
    } catch (error) {
      // User cancelled or error
      if ((error as Error).name !== "AbortError") {
        console.error("Share error:", error);
      }
      return false;
    }
  }

  /**
   * Share via specific provider (fallback)
   */
  shareVia(provider: ShareProvider, options: ShareData): void {
    const { title = "", text = "", url = "" } = options;
    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(text);
    const encodedTitle = encodeURIComponent(title);

    let shareUrl = "";

    switch (provider) {
      case "whatsapp":
        shareUrl = `https://wa.me/?text=${encodedText}${encodedUrl ? `%20${encodedUrl}` : ""}`;
        break;
      case "facebook":
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case "twitter":
        shareUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        break;
      case "linkedin":
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        break;
      case "telegram":
        shareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
        break;
      case "email":
        shareUrl = `mailto:?subject=${encodedTitle}&body=${encodedText}%0A%0A${encodedUrl}`;
        break;
      default:
        return;
    }

    window.open(shareUrl, "_blank", "width=600,height=400");
  }

  /**
   * Copy text to clipboard
   */
  async copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }

      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();

      const success = document.execCommand("copy");
      document.body.removeChild(textArea);
      return success;
    } catch {
      return false;
    }
  }

  /**
   * Share with fallback - tries native first, then shows modal options
   */
  async share(data: ShareData, options: ShareOptions = {}): Promise<boolean> {
    // Try native share first
    if (this.isSupported()) {
      const success = await this.shareNative(data);
      if (success) return true;
    }

    // If native fails or not supported, copy URL to clipboard as fallback
    if (data.url) {
      await this.copyToClipboard(data.url);
      options.onCopySuccess?.();
    }

    return false;
  }

  /**
   * Get share providers available
   */
  getAvailableProviders(): ShareProvider[] {
    // All providers are always available as fallbacks
    return ["whatsapp", "facebook", "telegram", "email", "twitter", "linkedin", "copy"];
  }

  /**
   * Generate share text from template
   */
  generateShareText(
    template: string,
    data: Record<string, string>
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
      result = result.replace(new RegExp(`{${key}}`, "g"), value);
    }
    return result;
  }
}

// Singleton instance
export const shareService = new ShareService();
