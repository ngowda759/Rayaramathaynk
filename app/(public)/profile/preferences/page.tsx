"use client";

import { useState } from "react";
import { useProfile } from "@/context/ProfileContext";
import { useAuthContext } from "@/context/AuthContext";
import Link from "next/link";
import toast from "react-hot-toast";
import { 
  ArrowLeft,
  Globe,
  Sun,
  Moon,
  Monitor,
  Bell,
  BellOff,
  Smartphone,
  Volume2,
  Vibrate,
  Play,
  Image
} from "lucide-react";
import { LanguageSwitcher } from "@/components/common/LanguageSwitcher";
import { THEMES, TIMEZONES, Theme } from "@/types/profile";

export default function ProfilePreferencesPage() {
  const { 
    preferences, 
    isLoading, 
    isAuthenticated,
    updateLanguage,
    updateTimezone,
    updateTheme,
    updateNotificationPreferences,
    updateDevicePreferences
  } = useProfile();
  const { user } = useAuthContext();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-stone-50 py-12">
        <div className="mx-auto max-w-2xl px-6">
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
            <p className="text-stone-600">Please sign in to access preferences.</p>
            <Link
              href="/login"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-3 font-semibold text-white"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  async function handleLanguageChange(locale: string) {
    try {
      await updateLanguage(locale as any);
      toast.success("Language updated!");
    } catch (error) {
      toast.error("Failed to update language");
    }
  }

  async function handleTimezoneChange(timezone: string) {
    try {
      await updateTimezone(timezone);
      toast.success("Timezone updated!");
    } catch (error) {
      toast.error("Failed to update timezone");
    }
  }

  async function handleThemeChange(theme: Theme) {
    try {
      await updateTheme(theme);
      toast.success("Theme updated!");
    } catch (error) {
      toast.error("Failed to update theme");
    }
  }

  async function handleNotificationToggle(key: keyof typeof preferences.notifications) {
    try {
      await updateNotificationPreferences({ [key]: !preferences.notifications[key] });
    } catch (error) {
      toast.error("Failed to update notification");
    }
  }

  async function handleDeviceToggle(key: keyof typeof preferences.device) {
    try {
      await updateDevicePreferences({ [key]: !preferences.device[key] });
    } catch (error) {
      toast.error("Failed to update preference");
    }
  }

  const notificationItems = [
    { key: "dailyPanchanga", label: "Daily Panchanga", description: "Receive today's panchanga every morning" },
    { key: "dailyQuote", label: "Daily Quote", description: "Get spiritual quotes daily" },
    { key: "events", label: "Upcoming Events", description: "Notifications for temple events" },
    { key: "festivals", label: "Festival Reminders", description: "Reminders before festivals" },
    { key: "aaradhane", label: "Aaradhane Schedule", description: "Daily Aaradhane reminders" },
    { key: "liveStream", label: "Live Darshan", description: "When live darshan begins" },
    { key: "announcements", label: "Announcements", description: "Important temple announcements" },
  ];

  const deviceItems = [
    { key: "soundEnabled", label: "Sound Effects", description: "Play sounds for notifications", icon: Volume2 },
    { key: "vibrationEnabled", label: "Vibration", description: "Vibrate on notifications", icon: Vibrate },
    { key: "autoPlayVideo", label: "Auto-play Videos", description: "Automatically play video content", icon: Play },
    { key: "highQualityImages", label: "High Quality Images", description: "Load full resolution images", icon: Image },
  ];

  return (
    <div className="min-h-screen bg-stone-50 py-12">
      <div className="mx-auto max-w-3xl px-6">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/profile"
            className="mb-4 inline-flex items-center gap-2 text-sm text-stone-600 hover:text-amber-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Profile
          </Link>
          <h1 className="text-3xl font-bold text-stone-900">Preferences</h1>
          <p className="mt-2 text-stone-600">Customize your experience</p>
        </div>

        {/* Language */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-stone-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Globe className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-900">Language</h2>
              <p className="text-sm text-stone-500">Choose your preferred language</p>
            </div>
          </div>
          <div className="mt-4">
            <LanguageSwitcher 
              variant="buttons" 
              className="flex-wrap"
            />
          </div>
        </div>

        {/* Theme */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-stone-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <Sun className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-900">Theme</h2>
              <p className="text-sm text-stone-500">Choose your display preference</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {THEMES.map((theme) => (
              <button
                key={theme.value}
                onClick={() => handleThemeChange(theme.value)}
                className={`
                  flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all
                  ${preferences.theme === theme.value
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-stone-200 text-stone-600 hover:border-stone-300"
                  }
                `}
                aria-pressed={preferences.theme === theme.value}
              >
                <span className="text-2xl">{theme.icon}</span>
                <span className="text-sm font-medium">{theme.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Timezone */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-stone-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <Smartphone className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-900">Timezone</h2>
              <p className="text-sm text-stone-500">Set your local timezone for accurate timings</p>
            </div>
          </div>
          <select
            value={preferences.timezone}
            onChange={(e) => handleTimezoneChange(e.target.value)}
            className="mt-4 block w-full rounded-xl border border-stone-300 px-4 py-2.5 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label} ({tz.offset})
              </option>
            ))}
          </select>
        </div>

        {/* Notifications */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-stone-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
              <Bell className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-900">Notifications</h2>
              <p className="text-sm text-stone-500">Choose what you want to be notified about</p>
            </div>
          </div>
          
          <div className="mt-4 space-y-3">
            {notificationItems.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between rounded-xl border border-stone-200 p-4 transition-colors hover:bg-stone-50"
              >
                <div className="flex-1">
                  <p className="font-medium text-stone-900">{item.label}</p>
                  <p className="text-sm text-stone-500">{item.description}</p>
                </div>
                <button
                  onClick={() => handleNotificationToggle(item.key as keyof typeof preferences.notifications)}
                  className={`
                    relative h-6 w-11 rounded-full transition-colors
                    ${preferences.notifications[item.key as keyof typeof preferences.notifications]
                      ? "bg-amber-500"
                      : "bg-stone-300"
                    }
                  `}
                  role="switch"
                  aria-checked={preferences.notifications[item.key as keyof typeof preferences.notifications]}
                >
                  <span
                    className={`
                      absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform
                      ${preferences.notifications[item.key as keyof typeof preferences.notifications]
                        ? "translate-x-5"
                        : "translate-x-0.5"
                      }
                    `}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Device Preferences */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-stone-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100">
              <Smartphone className="h-5 w-5 text-cyan-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-900">Device Settings</h2>
              <p className="text-sm text-stone-500">Customize your device experience</p>
            </div>
          </div>
          
          <div className="mt-4 space-y-3">
            {deviceItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-xl border border-stone-200 p-4 transition-colors hover:bg-stone-50"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-stone-400" />
                    <div>
                      <p className="font-medium text-stone-900">{item.label}</p>
                      <p className="text-sm text-stone-500">{item.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeviceToggle(item.key as keyof typeof preferences.device)}
                    className={`
                      relative h-6 w-11 rounded-full transition-colors
                      ${preferences.device[item.key as keyof typeof preferences.device]
                        ? "bg-amber-500"
                        : "bg-stone-300"
                      }
                    `}
                    role="switch"
                    aria-checked={preferences.device[item.key as keyof typeof preferences.device]}
                  >
                    <span
                      className={`
                        absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform
                        ${preferences.device[item.key as keyof typeof preferences.device]
                          ? "translate-x-5"
                          : "translate-x-0.5"
                        }
                      `}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
