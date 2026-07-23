"use client";

/**
 * Notification Preferences Page
 * Allows users to subscribe to various notification types
 */

import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import { useNotifications } from "@/lib/device";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import toast from "react-hot-toast";
import {
  Bell,
  Calendar,
  Quote,
  Sparkles,
  Heart,
  Megaphone,
  Check,
  Loader2,
} from "lucide-react";

interface NotificationPreferences {
  dailyPanchanga: boolean;
  dailyQuote: boolean;
  upcomingEvents: boolean;
  festivals: boolean;
  aaradhane: boolean;
  sevaReminders: boolean;
  donationReceipts: boolean;
  announcements: boolean;
}

const defaultPreferences: NotificationPreferences = {
  dailyPanchanga: false,
  dailyQuote: false,
  upcomingEvents: false,
  festivals: false,
  aaradhane: false,
  sevaReminders: false,
  donationReceipts: false,
  announcements: false,
};

const preferenceItems = [
  {
    key: "dailyPanchanga" as const,
    title: "Daily Panchanga",
    description: "Receive daily Hindu calendar information every morning at 6 AM",
    icon: Calendar,
  },
  {
    key: "dailyQuote" as const,
    title: "Daily Quote",
    description: "Receive daily spiritual inspiration and quotes",
    icon: Quote,
  },
  {
    key: "upcomingEvents" as const,
    title: "Upcoming Events",
    description: "Get notified about upcoming temple events and programs",
    icon: Sparkles,
  },
  {
    key: "festivals" as const,
    title: "Festival Alerts",
    description: "Receive reminders for important Hindu festivals",
    icon: Bell,
  },
  {
    key: "aaradhane" as const,
    title: "Guru Aaradhane",
    description: "Special notifications for Guru Aaradhane celebrations",
    icon: Heart,
  },
  {
    key: "sevaReminders" as const,
    title: "Seva Reminders",
    description: "Reminders for your booked sevas and puja services",
    icon: Calendar,
  },
  {
    key: "donationReceipts" as const,
    title: "Donation Receipts",
    description: "Receive confirmation for your donations",
    icon: Heart,
  },
  {
    key: "announcements" as const,
    title: "Announcements",
    description: "Important updates from the temple administration",
    icon: Megaphone,
  },
];

// Local storage key for preferences
const STORAGE_KEY = "temple-notification-preferences";

export default function NotificationPreferencesPage() {
  const notifications = useNotifications();
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return defaultPreferences;
        }
      }
    }
    return defaultPreferences;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Handle toggle
  const handleToggle = async (key: keyof NotificationPreferences) => {
    const newValue = !preferences[key];
    setPreferences((prev) => ({ ...prev, [key]: newValue }));
    setHasChanges(true);

    // Request notification permission if enabling any preference
    if (newValue && !notifications.isGranted) {
      const permission = await notifications.requestPermission();
      if (permission !== "granted") {
        toast.error("Please enable notifications to receive updates");
        setPreferences((prev) => ({ ...prev, [key]: false }));
        return;
      }
    }
  };

  // Save preferences
  const handleSave = () => {
    setIsSaving(true);
    
    // Save to local storage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    
    // Schedule notifications based on preferences
    if (preferences.dailyPanchanga) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(6, 0, 0, 0);
      
      notifications.scheduleEventReminder(
        "daily-panchanga",
        "Today's Panchanga",
        tomorrow,
        0
      );
    }

    setTimeout(() => {
      setIsSaving(false);
      setHasChanges(false);
      toast.success("Notification preferences saved");
    }, 500);
  };

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-gradient-to-b from-amber-50 to-white">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <Breadcrumb current="Notification Preferences" />
          
          {/* Header */}
          <div className="mt-8 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <Bell className="h-8 w-8 text-amber-600" />
            </div>
            <h1 className="mt-6 text-3xl font-bold text-stone-900">
              Notification Preferences
            </h1>
            <p className="mt-4 text-lg text-stone-600">
              Choose what updates you would like to receive from Sri Raghavendra Swamy Matha
            </p>
          </div>

          {/* Notification Status */}
          <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-stone-900">Notification Status</h3>
                <p className="text-sm text-stone-600">
                  {notifications.isGranted
                    ? "Notifications are enabled"
                    : notifications.isDenied
                    ? "Notifications are blocked"
                    : "Notifications not enabled"}
                </p>
              </div>
              <div
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                  notifications.isGranted
                    ? "bg-green-100 text-green-700"
                    : notifications.isDenied
                    ? "bg-red-100 text-red-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {notifications.isGranted
                  ? "Enabled"
                  : notifications.isDenied
                  ? "Blocked"
                  : "Not Set"}
              </div>
            </div>
            {!notifications.isGranted && !notifications.isDenied && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => notifications.requestPermission()}
              >
                Enable Notifications
              </Button>
            )}
          </div>

          {/* Preferences List */}
          <div className="mt-8 space-y-4">
            <h2 className="text-lg font-semibold text-stone-900">
              Subscribe to Updates
            </h2>
            {preferenceItems.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                    <item.icon className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-stone-900">{item.title}</h3>
                    <p className="text-sm text-stone-500">{item.description}</p>
                  </div>
                </div>
                <Switch
                  checked={preferences[item.key]}
                  onCheckedChange={() => handleToggle(item.key)}
                  disabled={notifications.isDenied}
                />
              </div>
            ))}
          </div>

          {/* Save Button */}
          <div className="mt-8 flex justify-center">
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="min-w-[200px]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : hasChanges ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Save Preferences
                </>
              ) : (
                "Preferences Saved"
              )}
            </Button>
          </div>

          {/* Info Note */}
          <div className="mt-8 rounded-xl bg-blue-50 p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Preferences are stored locally on this device. 
              To manage notifications across devices, please sign in to your account.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
