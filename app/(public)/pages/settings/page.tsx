"use client";

/**
 * Device Settings Page
 * Allows users to manage device preferences
 */

import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import { useDevice, useCapabilities, useNotifications } from "@/lib/device";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import toast from "react-hot-toast";
import {
  Settings,
  Smartphone,
  MapPin,
  Calendar,
  Share2,
  Bell,
  Check,
  Loader2,
  Globe,
  Battery,
  Wifi,
} from "lucide-react";

interface DeviceSettings {
  defaultNavigationApp: "google" | "apple" | "waze";
  defaultCalendarProvider: "google" | "apple" | "outlook";
  reminderMinutesBefore: number;
}

// Local storage key for settings
const STORAGE_KEY = "temple-device-settings";

const defaultSettings: DeviceSettings = {
  defaultNavigationApp: "google",
  defaultCalendarProvider: "google",
  reminderMinutesBefore: 30,
};

export default function DeviceSettingsPage() {
  const device = useDevice();
  const capabilities = useCapabilities();
  const notifications = useNotifications();
  
  const [settings, setSettings] = useState<DeviceSettings>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return defaultSettings;
        }
      }
    }
    return defaultSettings;
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Handle setting change
  const handleSettingChange = <K extends keyof DeviceSettings>(
    key: K,
    value: DeviceSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  // Save settings
  const handleSave = () => {
    setIsSaving(true);
    
    // Save to local storage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    
    setTimeout(() => {
      setIsSaving(false);
      setHasChanges(false);
      toast.success("Device settings saved");
    }, 500);
  };

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-gradient-to-b from-amber-50 to-white">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <Breadcrumb current="Device Settings" />
          
          {/* Header */}
          <div className="mt-8 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <Settings className="h-8 w-8 text-amber-600" />
            </div>
            <h1 className="mt-6 text-3xl font-bold text-stone-900">
              Device Settings
            </h1>
            <p className="mt-4 text-lg text-stone-600">
              Customize how you interact with the temple website
            </p>
          </div>

          {/* Device Info */}
          <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h3 className="flex items-center gap-2 font-semibold text-stone-900">
              <Smartphone className="h-5 w-5 text-amber-600" />
              Device Information
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-stone-500">Platform</p>
                <p className="font-medium capitalize">{device.platform}</p>
              </div>
              <div>
                <p className="text-stone-500">Browser</p>
                <p className="font-medium capitalize">{device.browser}</p>
              </div>
              <div>
                <p className="text-stone-500">Device Type</p>
                <p className="font-medium">
                  {device.isMobile ? "Mobile" : device.isTablet ? "Tablet" : "Desktop"}
                </p>
              </div>
              <div>
                <p className="text-stone-500">Touch Support</p>
                <p className="font-medium">{device.isTouchDevice ? "Yes" : "No"}</p>
              </div>
            </div>
          </div>

          {/* Device Capabilities */}
          <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h3 className="flex items-center gap-2 font-semibold text-stone-900">
              <Globe className="h-5 w-5 text-amber-600" />
              Device Capabilities
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-stone-600">Camera</span>
                <span className={`font-medium ${capabilities.cameraSupported ? "text-green-600" : "text-stone-400"}`}>
                  {capabilities.cameraSupported ? "Supported" : "Not Supported"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-600">Location</span>
                <span className={`font-medium ${capabilities.gpsSupported ? "text-green-600" : "text-stone-400"}`}>
                  {capabilities.gpsSupported ? "Supported" : "Not Supported"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-600">Share</span>
                <span className={`font-medium ${capabilities.shareSupported ? "text-green-600" : "text-stone-400"}`}>
                  {capabilities.shareSupported ? "Supported" : "Not Supported"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-600">Notifications</span>
                <span className={`font-medium ${capabilities.notificationSupported ? "text-green-600" : "text-stone-400"}`}>
                  {capabilities.notificationSupported ? "Supported" : "Not Supported"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-600">Calendar</span>
                <span className={`font-medium ${capabilities.calendarSupported ? "text-green-600" : "text-stone-400"}`}>
                  {capabilities.calendarSupported ? "Supported" : "Not Supported"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-600">Clipboard</span>
                <span className={`font-medium ${capabilities.clipboardSupported ? "text-green-600" : "text-stone-400"}`}>
                  {capabilities.clipboardSupported ? "Supported" : "Not Supported"}
                </span>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h3 className="flex items-center gap-2 font-semibold text-stone-900">
              <Settings className="h-5 w-5 text-amber-600" />
              Preferences
            </h3>
            
            {/* Navigation App */}
            <div className="mt-6">
              <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
                <MapPin className="h-4 w-4" />
                Default Navigation App
              </label>
              <Select
                value={settings.defaultNavigationApp}
                onValueChange={(value) => handleSettingChange("defaultNavigationApp", value as DeviceSettings["defaultNavigationApp"])}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="google">Google Maps</SelectItem>
                  <SelectItem value="apple">Apple Maps</SelectItem>
                  <SelectItem value="waze">Waze</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-stone-500">
                Opens when you click &quot;Get Directions&quot;
              </p>
            </div>

            {/* Calendar Provider */}
            <div className="mt-6">
              <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
                <Calendar className="h-4 w-4" />
                Default Calendar
              </label>
              <Select
                value={settings.defaultCalendarProvider}
                onValueChange={(value) => handleSettingChange("defaultCalendarProvider", value as DeviceSettings["defaultCalendarProvider"])}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="google">Google Calendar</SelectItem>
                  <SelectItem value="apple">Apple Calendar</SelectItem>
                  <SelectItem value="outlook">Outlook</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-stone-500">
                Opens when you click &quot;Add to Calendar&quot;
              </p>
            </div>

            {/* Reminder Time */}
            <div className="mt-6">
              <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
                <Bell className="h-4 w-4" />
                Default Reminder Time
              </label>
              <Select
                value={settings.reminderMinutesBefore.toString()}
                onValueChange={(value) => {
                  if (value) {
                    handleSettingChange("reminderMinutesBefore", parseInt(value) || 30);
                  }
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes before</SelectItem>
                  <SelectItem value="30">30 minutes before</SelectItem>
                  <SelectItem value="60">1 hour before</SelectItem>
                  <SelectItem value="120">2 hours before</SelectItem>
                  <SelectItem value="1440">1 day before</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-stone-500">
                Default time before events to send reminders
              </p>
            </div>
          </div>

          {/* Notification Status */}
          <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h3 className="flex items-center gap-2 font-semibold text-stone-900">
              <Bell className="h-5 w-5 text-amber-600" />
              Notification Permission
            </h3>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-stone-900">
                  {notifications.isGranted
                    ? "Notifications Enabled"
                    : notifications.isDenied
                    ? "Notifications Blocked"
                    : "Notifications Not Enabled"}
                </p>
                <p className="text-sm text-stone-500">
                  {notifications.isGranted
                    ? `${notifications.scheduledCount} reminder(s) scheduled`
                    : "Enable notifications to receive updates"}
                </p>
              </div>
              {!notifications.isGranted && !notifications.isDenied && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => notifications.requestPermission()}
                >
                  Enable
                </Button>
              )}
            </div>
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
                  Save Settings
                </>
              ) : (
                "Settings Saved"
              )}
            </Button>
          </div>

          {/* Info Note */}
          <div className="mt-8 rounded-xl bg-blue-50 p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Settings are stored locally on this device. 
              To sync settings across devices, please sign in to your account.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
