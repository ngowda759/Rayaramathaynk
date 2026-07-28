"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Quote } from "@/types/quote";
import { Star, BookOpen, Languages, Share2, Copy, Check, Loader2 } from "lucide-react";
import { useShare } from "@/lib/device";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";

interface DailyQuoteWidgetProps {
  initialQuote?: Quote | null;
  className?: string;
}

function QuoteSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-6 shadow-lg ring-1 ring-indigo-100">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-indigo-200" />
        <div className="h-6 w-32 rounded bg-indigo-200" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-full rounded bg-indigo-200" />
        <div className="h-4 w-3/4 rounded bg-indigo-200" />
        <div className="h-4 w-5/6 rounded bg-indigo-200" />
      </div>
      <div className="mt-4 h-4 w-1/2 rounded bg-indigo-200 ml-auto" />
    </div>
  );
}

function QuoteError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-red-50 to-orange-50 p-6 shadow-lg ring-1 ring-red-100">
      <div className="text-center">
        <p className="text-muted-foreground">Unable to load today&apos;s quote</p>
        <button
          onClick={onRetry}
          className="mt-2 text-sm text-indigo-600 hover:text-indigo-800"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export function DailyQuoteWidget({ initialQuote, className = "" }: DailyQuoteWidgetProps) {
  const [quote, setQuote] = useState<Quote | null>(initialQuote || null);
  const [loading, setLoading] = useState(!initialQuote);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  
  const share = useShare();

  const fetchQuote = async () => {
    try {
      setLoading(true);
      setError(false);
      const response = await fetch("/api/quotes/today");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setQuote(data.quote);
    } catch (err) {
      console.error("Failed to fetch quote:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialQuote) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Data fetching pattern
      fetchQuote();
    }
  }, [initialQuote]);

  // Generate quote text for sharing/copying
  const getQuoteText = () => {
    if (!quote) return "";
    const parts: string[] = [];
    if (quote.content.translationEnglish) {
      parts.push(`"${quote.content.translationEnglish}"`);
    }
    if (quote.content.kannada || quote.content.sanskrit) {
      parts.push(quote.content.kannada || quote.content.sanskrit || "");
    }
    parts.push(`— ${quote.source}${quote.author ? ` (${quote.author})` : ""}`);
    parts.push("\nSri Raghavendra Swamy Matha");
    return parts.join("\n\n");
  };

  // Share quote
  const handleShareQuote = async () => {
    if (!quote) return;
    setIsSharing(true);
    
    const text = quote.content.translationEnglish || 
      quote.content.kannada || 
      quote.content.sanskrit || 
      "";
    
    const success = await share.share({
      title: "Daily Inspiration",
      text: `"${text}"\n\n— ${quote.source}\n\nSri Raghavendra Swamy Matha`,
    });
    
    setIsSharing(false);
    if (success) {
      toast.success("Quote has been shared");
    }
  };

  // Copy quote
  const handleCopyQuote = async () => {
    const text = getQuoteText();
    const success = await share.copyToClipboard(text);
    
    if (success) {
      setCopied(true);
      toast.success("Quote copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className={className}>
        <QuoteSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <QuoteError onRetry={fetchQuote} />
      </div>
    );
  }

  if (!quote) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={`rounded-3xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-6 shadow-lg ring-1 ring-indigo-100 ${className}`}
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 text-white">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold text-stone-900">Daily Inspiration</h3>
          <p className="text-xs text-muted-foreground">
            {quote.category.replace(/_/g, " ")}
          </p>
        </div>
        {quote.featured && (
          <Star className="ml-auto h-5 w-5 text-amber-500 fill-amber-500" />
        )}
      </div>

      {/* Quote Content */}
      <div className="space-y-4">
        {/* Kannada/Sanskrit Text */}
        {(quote.content.kannada || quote.content.sanskrit) && (
          <div className="rounded-xl bg-white/60 p-4 shadow-sm">
            <div className="flex items-start gap-2">
              <Languages className="mt-1 h-4 w-4 shrink-0 text-indigo-400" />
              <p className="font-serif text-lg leading-relaxed text-stone-800" dir="auto">
                {quote.content.kannada || quote.content.sanskrit}
              </p>
            </div>
          </div>
        )}

        {/* Transliteration */}
        {quote.content.transliteration && (
          <p className="italic text-stone-600">
            {quote.content.transliteration}
          </p>
        )}

        {/* English Translation */}
        {quote.content.translationEnglish && (
          <blockquote className="relative border-l-4 border-indigo-300 pl-4">
            <p className="text-stone-700">&ldquo;{quote.content.translationEnglish}&rdquo;</p>
          </blockquote>
        )}

        {/* Verse Number */}
        {quote.verseNumber && (
          <p className="text-center text-xs text-muted-foreground">
            Verse {quote.verseNumber}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-indigo-100 pt-4">
        <div>
          <p className="font-medium text-stone-900">{quote.source}</p>
          {quote.author && (
            <p className="text-xs text-muted-foreground">— {quote.author}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {quote.tags.length > 0 && (
            <div className="flex gap-1">
              {quote.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          
          {/* Share and Copy Buttons */}
          <div className="ml-2 flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShareQuote}
              disabled={isSharing}
              className="h-8 w-8 p-0"
            >
              {isSharing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyQuote}
              className="h-8 w-8 p-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default DailyQuoteWidget;
