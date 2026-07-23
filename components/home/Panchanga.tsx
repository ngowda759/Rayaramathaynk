"use client";

import React from "react";
import {
  CalendarDays,
  MoonStar,
  Sunrise,
  Sunset,
  Clock,
  Flame,
  Share2,
  Bell,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { useHomepage } from "@/hooks/useHomepage";
import { useShare, useNotifications } from "@/lib/device";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";

const DEFAULT_PLACEHOLDER = "—";

type PanchangaShape = {
  tithi?: string;
  nakshatra?: string;
  yoga?: string;
  karana?: string;
  sunrise?: string;
  sunset?: string;
  rahuKalam?: string;
  gulikaKalam?: string;
  masa?: string;
};

type LivePanchanga = {
  tithi?: string;
  nakshatra?: string;
  yoga?: string;
  karana?: string;
  sunrise?: string;
  sunset?: string;
  rahuKalam?: string;
  gulikaKalam?: string;
  masa?: string;
};

export default function Panchanga() {
  const { homepage, loading } = useHomepage();

  const cms = (homepage?.panchanga ?? {}) as PanchangaShape;

  const [live, setLive] = React.useState<LivePanchanga | null>(
    null
  );

  const [copied, setCopied] = React.useState(false);
  const [isSharing, setIsSharing] = React.useState(false);
  const [isNotifyLoading, setIsNotifyLoading] = React.useState(false);
  const [notifySet, setNotifySet] = React.useState(false);
  
  const share = useShare();
  const notifications = useNotifications();

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          "/data/panchanga/current.json",
          {
            cache: "no-store",
          }
        );

        const json = await res.json();

        if (!json || json.error) return;

        setLive({
          tithi: json.tithi?.name,
          nakshatra: json.nakshatra?.name,
          yoga: json.yoga?.name,
          karana: json.karana?.name,
          rahuKalam: json.rahu_kalam?.start
            ? new Date(json.rahu_kalam.start).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : undefined,
          gulikaKalam: json.gulika_kalam?.start
            ? new Date(json.gulika_kalam.start).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : undefined,
          masa: json.masa?.name,

          sunrise: json.sun?.sunrise
            ? new Date(json.sun.sunrise).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : undefined,

          sunset: json.sun?.sunset
            ? new Date(json.sun.sunset).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : undefined,
        });
      } catch (err) {
        console.error(err);
      }
    }

    load();
  }, []);

  // Generate Panchanga summary text
  const getPanchangaSummary = () => {
    const parts: string[] = [];
    if (live?.tithi) parts.push(`Tithi: ${live.tithi}`);
    if (live?.nakshatra) parts.push(`Nakshatra: ${live.nakshatra}`);
    if (live?.sunrise) parts.push(`Sunrise: ${live.sunrise}`);
    if (live?.sunset) parts.push(`Sunset: ${live.sunset}`);
    if (live?.rahuKalam) parts.push(`Rahu Kalam: ${live.rahuKalam}`);
    return parts.join(" | ");
  };

  	  // Share Panchanga
  const handleSharePanchanga = async () => {
    setIsSharing(true);
    const summary = getPanchangaSummary();
    const dateStr = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    
    const success = await share.share({
      title: "Today's Panchanga - Sri Raghavendra Swamy Matha",
      text: `Panchanga for ${dateStr}\n\n${summary}\n\nSri Raghavendra Swamy Matha, Yelahanka`,
      url: typeof window !== "undefined" ? window.location.href : "",
    });
    
    setIsSharing(false);
    if (success) {
      toast.success("Panchanga has been shared");
    }
  };

  // Copy Panchanga
  const handleCopyPanchanga = async () => {
    const summary = getPanchangaSummary();
    const dateStr = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    
    const text = `Panchanga for ${dateStr}\n\n${summary}`;
    const success = await share.copyToClipboard(text);
    
    if (success) {
      setCopied(true);
      toast.success("Panchanga copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Set daily Panchanga reminder
  const handleSetReminder = async () => {
    setIsNotifyLoading(true);
    
    try {
      if (!notifications.isGranted) {
        const permission = await notifications.requestPermission();
        if (permission !== "granted") {
          toast.error("Please enable notifications to set reminders");
          setIsNotifyLoading(false);
          return;
        }
      }

      // Schedule for 6 AM tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(6, 0, 0, 0);

      notifications.scheduleEventReminder(
        "daily-panchanga",
        "Today's Panchanga Available",
        tomorrow,
        0
      );

      setNotifySet(true);
      toast.success("Reminder set for daily Panchanga at 6 AM");
    } catch {
      toast.error("Failed to set reminder");
    }
    
    setIsNotifyLoading(false);
  };

  // Helper to safely get string value
  const getValue = (v: unknown): string => {
    if (!v || typeof v !== 'string') return DEFAULT_PLACEHOLDER;
    return v;
  };

  const items = [
    {
      title: "Tithi",
      value: getValue(live?.tithi ?? cms.tithi),
      icon: MoonStar,
      color: "from-violet-500 to-purple-600",
    },
    {
      title: "Nakshatra",
      value: getValue(live?.nakshatra ?? cms.nakshatra),
      icon: CalendarDays,
      color: "from-amber-500 to-orange-500",
    },
    {
      title: "Sunrise",
      value: getValue(
        live?.sunrise ??
          cms.sunrise ??
          homepage?.morningOpen
      ),
      icon: Sunrise,
      color: "from-orange-500 to-yellow-500",
    },
    {
      title: "Sunset",
      value: getValue(
        live?.sunset ??
          cms.sunset ??
          homepage?.eveningClose
      ),
      icon: Sunset,
      color: "from-sky-500 to-indigo-600",
    },
    {
      title: "Rahu Kala",
      value: getValue(live?.rahuKalam ?? cms.rahuKalam),
      icon: Clock,
      color: "from-red-500 to-rose-600",
    },
    {
      title: "Gulika Kala",
      value: getValue(live?.gulikaKalam ?? cms.gulikaKalam),
      icon: Clock,
      color: "from-emerald-500 to-teal-600",
    },
    {
      title: "Masa",
      value: getValue(live?.masa ?? cms.masa),
      icon: Flame,
      color: "from-pink-500 to-rose-600",
    },
  ];

  if (loading) {
    return (
      <section className="bg-gradient-to-b from-white to-[#fff9ef] py-20">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
          <p className="mt-5 text-stone-600">
            Loading Panchanga...
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-gradient-to-b from-white to-[#fff9ef] py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <span className="rounded-full bg-amber-100 px-5 py-2 text-sm font-semibold text-amber-700">
            TODAY&apos;S PANCHANGA
          </span>

          <h2 className="mt-5 text-4xl font-bold text-stone-900">
            Daily Panchanga
          </h2>

          <p className="mt-4 text-stone-600">
            Daily Hindu calendar information for devotees.
          </p>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSharePanchanga}
              disabled={isSharing}
              className="gap-2"
            >
              {isSharing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              Share
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyPanchanga}
              className="gap-2"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied!" : "Copy"}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleSetReminder}
              disabled={isNotifyLoading}
              className={`gap-2 ${notifySet ? "border-green-300 bg-green-50" : ""}`}
            >
              {isNotifyLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bell className={`h-4 w-4 ${notifySet ? "text-green-600" : ""}`} />
              )}
              {notifySet ? "Reminder Set" : "Notify Daily"}
            </Button>
          </div>
        </div>

        <div className="mt-12 grid gap-3 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item, index) => {
            const Icon = item.icon;

            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
                className="rounded-2xl border border-amber-100 bg-white p-5 shadow-md"
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${item.color} text-white`}
                >
                  <Icon size={22} />
                </div>

                <h3 className="mt-4 text-sm font-medium text-stone-500">
                  {item.title}
                </h3>

                <p className="mt-1 text-xl font-bold text-stone-900 break-words leading-tight">
                  {item.value}
                </p>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
