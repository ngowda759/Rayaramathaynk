"use client";

/**
 * ShareButton Component
 * Native share with fallback modal
 */

import { useState } from "react";
import { useShare, useShareContent } from "@/lib/device/hooks";
import {
  Share2,
  Copy,
  Check,
  Loader2,
  MessageCircle,
  Mail,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Simple icon components for social platforms
const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const TwitterIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const LinkedinIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

interface ShareButtonProps {
  title?: string;
  text?: string;
  url?: string;
  contentType?: "event" | "seva" | "gallery" | "donation" | "quote" | "panchanga";
  variant?: "primary" | "outline" | "ghost";
  size?: "default" | "sm" | "icon" | "icon-sm";
  showLabel?: boolean;
  className?: string;
  onShare?: (provider: string) => void;
}

const providerIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  whatsapp: MessageCircle,
  facebook: FacebookIcon,
  twitter: TwitterIcon,
  linkedin: LinkedinIcon,
  email: Mail,
  telegram: Send,
  copy: Copy,
  native: Share2,
};

const providerLabels: Record<string, string> = {
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  twitter: "X (Twitter)",
  linkedin: "LinkedIn",
  email: "Email",
  telegram: "Telegram",
  copy: "Copy Link",
  native: "Share",
};

export function ShareButton({
  title,
  text,
  url,
  contentType = "event",
  variant = "outline",
  size = "sm",
  showLabel = true,
  className = "",
  onShare,
}: ShareButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const share = useShare();
  const shareContent = useShareContent(contentType, { title, text, url });

  const handleShare = async () => {
    setIsSharing(true);
    const success = await shareContent.share();
    if (success) {
      onShare?.("native");
    }
    setIsSharing(false);
    if (!success) {
      setShowModal(true);
    }
  };

  const handleCopy = async () => {
    const success = await shareContent.copyLink();
    if (success) {
      setCopied(true);
      onShare?.("copy");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleProviderClick = (provider: string) => {
    switch (provider) {
      case "whatsapp":
        shareContent.shareViaWhatsApp();
        break;
      case "facebook":
        shareContent.shareViaFacebook();
        break;
      case "twitter":
        shareContent.shareViaTwitter();
        break;
      case "linkedin":
        shareContent.shareViaLinkedIn();
        break;
      case "telegram":
        shareContent.shareViaTelegram();
        break;
      case "email":
        shareContent.shareViaEmail();
        break;
      case "copy":
        handleCopy();
        return;
    }
    onShare?.(provider);
    setShowModal(false);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleShare}
        disabled={isSharing}
      >
        {isSharing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Share2 className="mr-2 h-4 w-4" />
        )}
        {showLabel && (size !== "icon") && "Share"}
      </Button>

      {/* Fallback Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-orange-600" />
              Share
            </DialogTitle>
            <DialogDescription>
              {title || "Share this content"}
            </DialogDescription>
          </DialogHeader>

          {/* Share Preview */}
          {shareContent.shareText && (
            <div className="bg-stone-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-stone-700 line-clamp-3">
                {shareContent.shareText}
              </p>
            </div>
          )}

          {/* Share Options */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => handleProviderClick("whatsapp")}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-stone-50 transition-colors"
            >
              <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center">
                <MessageCircle className="h-6 w-6 text-white" />
              </div>
              <span className="text-sm font-medium">WhatsApp</span>
            </button>

            <button
              onClick={() => handleProviderClick("facebook")}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-stone-50 transition-colors"
            >
              <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center">
                <FacebookIcon className="h-6 w-6 text-white" />
              </div>
              <span className="text-sm font-medium">Facebook</span>
            </button>

            <button
              onClick={() => handleProviderClick("twitter")}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-stone-50 transition-colors"
            >
              <div className="h-12 w-12 rounded-full bg-black flex items-center justify-center">
                <TwitterIcon className="h-6 w-6 text-white" />
              </div>
              <span className="text-sm font-medium">X</span>
            </button>

            <button
              onClick={() => handleProviderClick("linkedin")}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-stone-50 transition-colors"
            >
              <div className="h-12 w-12 rounded-full bg-blue-700 flex items-center justify-center">
                <LinkedinIcon className="h-6 w-6 text-white" />
              </div>
              <span className="text-sm font-medium">LinkedIn</span>
            </button>

            <button
              onClick={() => handleProviderClick("telegram")}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-stone-50 transition-colors"
            >
              <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center">
                <Send className="h-6 w-6 text-white" />
              </div>
              <span className="text-sm font-medium">Telegram</span>
            </button>

            <button
              onClick={() => handleProviderClick("email")}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-stone-50 transition-colors"
            >
              <div className="h-12 w-12 rounded-full bg-stone-500 flex items-center justify-center">
                <Mail className="h-6 w-6 text-white" />
              </div>
              <span className="text-sm font-medium">Email</span>
            </button>
          </div>

          {/* Copy Link */}
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={shareContent.shareUrl || ""}
              readOnly
              className="flex-1 px-3 py-2 text-sm border rounded-lg bg-stone-50"
            />
            <Button onClick={handleCopy} variant="outline" size="sm">
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Compact Share Button - Just shows icon
 */
export function ShareIconButton(props: Omit<ShareButtonProps, "showLabel" | "size">) {
  return <ShareButton {...props} showLabel={false} size="icon" />;
}

/**
 * Share Dropdown - Compact share options
 */
interface ShareDropdownProps {
  title?: string;
  text?: string;
  url?: string;
  contentType?: "event" | "seva" | "gallery" | "donation" | "quote" | "panchanga";
  className?: string;
}

export function ShareDropdown({
  title,
  text,
  url,
  contentType = "event",
  className = "",
}: ShareDropdownProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareContent = useShareContent(contentType, { title, text, url });

  const handleCopy = async () => {
    const success = await shareContent.copyLink();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const providers = [
    { id: "whatsapp", icon: MessageCircle, color: "bg-green-500" },
    { id: "facebook", icon: FacebookIcon, color: "bg-blue-600" },
    { id: "twitter", icon: TwitterIcon, color: "bg-black" },
    { id: "telegram", icon: Send, color: "bg-blue-500" },
    { id: "email", icon: Mail, color: "bg-stone-500" },
  ];

  return (
    <div className={`relative inline-block ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <Share2 className="h-4 w-4" />
      </Button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-20 py-2">
            {providers.map(({ id, icon: Icon, color }) => (
              <button
                key={id}
                onClick={() => {
                  shareContent.shareVia(id as any);
                  setShowDropdown(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-stone-50 transition-colors"
              >
                <div className={`h-8 w-8 rounded-full ${color} flex items-center justify-center`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium">
                  {providerLabels[id]}
                </span>
              </button>
            ))}
            <hr className="my-2" />
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-stone-50 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-stone-200 flex items-center justify-center">
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 text-stone-600" />
                )}
              </div>
              <span className="text-sm font-medium">
                {copied ? "Copied!" : "Copy Link"}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
