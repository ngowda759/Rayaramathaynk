"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useProfile } from "@/context/ProfileContext";
import { useAuthContext } from "@/context/AuthContext";
import { useNotifications } from "@/lib/device/hooks/useNotifications";
import { CardSkeleton } from "@/components/common/SkeletonLoader";
import {
  Bell,
  BellOff,
  Calendar,
  Quote,
  Star,
  Video,
  Radio,
  Sparkles,
  Megaphone,
  Check,
  Clock,
  Trash2,
  Settings,
  Info,
} from "lucide-react";

interface NotificationTypeConfig {
  id: string;
  label: string;
  description: string;
  icon: typeof Bell;
  color: string;
}

const NOTIFICATION_TYPES: NotificationTypeConfig[] = [
  {
    id: "dailyPanchanga",
    label: "Daily Panchanga",
    description: "Receive today's panchanga every morning at 6:00 AM",
    icon: Calendar,
    color: "text-amber-600 bg-amber-100",
  },
  {
    id: "dailyQuote",
    label: "Daily Quote",
    description: "Get spiritual quotes from Sri Raghavendra Swamy daily",
    icon: Quote,
    color: "text-purple-600 bg-purple-100",
  },
  {
    id: "events",
    label: "Upcoming Events",
    description: "Notifications for temple events and programs",
    icon: Star,
    color: "text-blue-600 bg-blue-100",
  },
  {
    id: "festivals",
    label: "Festival Reminders",
    description: "Reminders before important festivals",
    icon: Sparkles,
    color: "text-orange-600 bg-orange-100",
  },
  {
    id: "aaradhane",
    label: "Aaradhane Reminder",
    description: "Daily Aaradhane schedule reminders",
    icon: Bell,
    color: "text-green-600 bg-green-100",
  },
  {
    id: "liveStream",
    label: "Live Darshan",
    description: "When live darshan streams begin",
    icon: Radio,
    color: "text-red-600 bg-red-100",
  },
  {
    id: "announcements",
    label: "General Announcements",
    description: "Important temple announcements and updates",
    icon: Megaphone,
    color: "text-cyan-600 bg-cyan-100",
  },
];

export default function NotificationCenterPage() {
  const { user } = useAuthContext();
  const { preferences, updateNotificationPreferences, isLoading } = useProfile();
  const {
    isSupported,
    permission,
    isGranted,
    requestPermission,
    scheduledCount,
    getScheduled,
    cancel,
    showTest,
  } = useNotifications();

  const [scheduled, setScheduled] = useState<any[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    setScheduled(getScheduled());
  }, [scheduledCount]);

  async function handleToggle(notificationId: string) {
    setUpdating(notificationId);
    try {
      const currentValue = preferences.notifications[notificationId as keyof typeof preferences.notifications];
      await updateNotificationPreferences({ [notificationId]: !currentValue });
    } finally {
      setUpdating(null);
    }
  }

  async function handleRequestPermission() {
    await requestPermission();
  }

  async function handleTestNotification() {
    showTest();
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 py-12">
        <div className="mx-auto max-w-2xl px-6">
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <Bell className="h-8 w-8 text-amber-600" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-stone-900">
              Sign in to manage notifications
            </h1>
            <p className="mb-6 text-stone-600">
              Create an account or sign in to customize your notification preferences.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 px-6 py-3 font-semibold text-white"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-6 py-3 font-semibold text-stone-700"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 py-12">
      <div className="mx-auto max-w-4xl px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-900">Notification Center</h1>
          <p className="mt-2 text-stone-600">
            Customize your notification preferences and manage scheduled reminders
          </p>
        </div>

        {/* Browser Permission Banner */}
        {!isSupported ? (
          <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <Info className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-900">
                  Browser notifications not supported
                </h3>
                <p className="mt-1 text-sm text-amber-700">
                  Your browser doesn't support push notifications. You'll still receive email notifications if enabled.
                </p>
              </div>
            </div>
          </div>
        ) : !isGranted && permission !== "denied" ? (
          <div className="mb-8 rounded-2xl border border-blue-200 bg-blue-50 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
                <Bell className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900">
                  Enable browser notifications
                </h3>
                <p className="mt-1 text-sm text-blue-700">
                  Get real-time updates directly in your browser for events, festivals, and live darshan.
                </p>
              </div>
              <button
                onClick={handleRequestPermission}
                className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Enable
              </button>
            </div>
          </div>
        ) : permission === "denied" ? (
          <div className="mb-8 rounded-2xl border border-stone-200 bg-stone-100 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-200">
                <BellOff className="h-5 w-5 text-stone-600" />
              </div>
              <div>
                <h3 className="font-semibold text-stone-900">
                  Notifications blocked
                </h3>
                <p className="mt-1 text-sm text-stone-600">
                  Notifications are blocked in your browser settings. Please enable them in your browser preferences.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Notification Types */}
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-stone-900">
            Notification Preferences
          </h2>
          <div className="space-y-4">
            {NOTIFICATION_TYPES.map((type) => {
              const Icon = type.icon;
              const isEnabled = preferences.notifications[type.id as keyof typeof preferences.notifications];
              const isUpdatingThis = updating === type.id;

              return (
                <div
                  key={type.id}
                  className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4 transition-colors hover:bg-stone-50"
                >
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${type.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-stone-900">{type.label}</h3>
                      <p className="text-sm text-stone-500">{type.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle(type.id)}
                    disabled={isUpdatingThis}
                    className={`
                      relative h-6 w-11 rounded-full transition-colors
                      ${isEnabled ? "bg-amber-500" : "bg-stone-300"}
                      ${isUpdatingThis ? "opacity-50" : ""}
                    `}
                    role="switch"
                    aria-checked={isEnabled}
                  >
                    <span
                      className={`
                        absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform
                        ${isEnabled ? "translate-x-5" : "translate-x-0.5"}
                      `}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scheduled Notifications */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-900">
              Scheduled Notifications
            </h2>
            <span className="text-sm text-stone-500">
              {scheduled.length} active
            </span>
          </div>
          
          {scheduled.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white p-8 text-center">
              <Clock className="mx-auto h-10 w-10 text-stone-300" />
              <p className="mt-2 text-sm text-stone-600">
                No scheduled notifications. Enable notification types above to receive reminders.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduled.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
                      <Bell className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-stone-900">{notification.title}</p>
                      <p className="text-sm text-stone-500">
                        {notification.body}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => cancel(notification.id)}
                    className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-red-600"
                    aria-label="Cancel notification"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Test Notification */}
        <div className="rounded-xl border border-stone-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium text-stone-900">Test Notifications</h3>
                <p className="text-sm text-stone-500">
                  Send a test notification to verify your setup
                </p>
              </div>
            </div>
            <button
              onClick={handleTestNotification}
              disabled={!isGranted}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send Test
            </button>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-8 rounded-xl border border-stone-200 bg-stone-50 p-6">
          <h3 className="flex items-center gap-2 font-semibold text-stone-900">
            <Info className="h-5 w-5 text-stone-500" />
            About Notifications
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-stone-600">
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              Email notifications are sent regardless of browser permissions
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              Browser notifications require permission to be enabled
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              Festival reminders are sent 7 days before the event
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              Event reminders are sent 30 minutes before start time
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
