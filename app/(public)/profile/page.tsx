"use client";

import { useProfile } from "@/context/ProfileContext";
import { useAuthContext } from "@/context/AuthContext";
import Link from "next/link";
import Image from "next/image";
import { 
  User, 
  Settings, 
  Bell, 
  Heart, 
  Clock, 
  ChevronRight,
  Camera,
  Loader2
} from "lucide-react";
import { LanguageSwitcher } from "@/components/common/LanguageSwitcher";

export default function ProfilePage() {
  const { profile, isLoading, isAuthenticated } = useProfile();
  const { user } = useAuthContext();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-stone-50 py-12">
        <div className="mx-auto max-w-2xl px-6">
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <User className="h-8 w-8 text-amber-600" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-stone-900">
              Sign in to view your profile
            </h1>
            <p className="mb-6 text-stone-600">
              Create an account or sign in to save your preferences and access personalized features.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-xl"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-6 py-3 font-semibold text-stone-700 transition-all hover:bg-stone-50"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 py-12">
        <div className="mx-auto max-w-4xl px-6">
          <div className="animate-pulse space-y-6">
            <div className="h-32 rounded-2xl bg-stone-200" />
            <div className="grid gap-6 md:grid-cols-3">
              <div className="h-48 rounded-xl bg-stone-200" />
              <div className="h-48 rounded-xl bg-stone-200" />
              <div className="h-48 rounded-xl bg-stone-200" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 py-12">
      <div className="mx-auto max-w-4xl px-6">
        {/* Profile Header */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="h-32 bg-gradient-to-r from-amber-600 to-orange-500" />
          <div className="px-6 pb-6">
            <div className="-mt-16 mb-4 flex flex-col items-start gap-4 sm:flex-row sm:items-end">
              <div className="relative">
                <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-stone-200 shadow-lg">
                  {profile?.profileImage || user?.photoURL ? (
                    <Image
                      src={profile?.profileImage || user?.photoURL || ""}
                      alt={profile?.name || "Profile"}
                      width={128}
                      height={128}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <User className="h-12 w-12 text-stone-400" />
                    </div>
                  )}
                </div>
                <button
                  className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-amber-600 text-white shadow-lg transition-colors hover:bg-amber-700"
                  aria-label="Change profile photo"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-stone-900">
                  {profile?.name || user?.displayName || "Devotee"}
                </h1>
                <p className="text-stone-600">{profile?.email || user?.email}</p>
                {profile?.phone && (
                  <p className="mt-1 text-sm text-stone-500">{profile.phone}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <LanguageSwitcher variant="buttons" />
              </div>
            </div>
          </div>
        </div>

        {/* Profile Menu */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Quick Actions */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Quick Actions
            </h2>
            
            <Link
              href="/profile/settings"
              className="flex items-center gap-4 rounded-xl border border-stone-200 bg-white p-4 transition-all hover:border-amber-300 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Settings className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-stone-900">Account Settings</p>
                <p className="text-sm text-stone-500">Manage your account</p>
              </div>
              <ChevronRight className="h-5 w-5 text-stone-400" />
            </Link>

            <Link
              href="/profile/preferences"
              className="flex items-center gap-4 rounded-xl border border-stone-200 bg-white p-4 transition-all hover:border-amber-300 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <Bell className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-stone-900">Preferences</p>
                <p className="text-sm text-stone-500">Notifications & theme</p>
              </div>
              <ChevronRight className="h-5 w-5 text-stone-400" />
            </Link>

            <Link
              href="/favorites"
              className="flex items-center gap-4 rounded-xl border border-stone-200 bg-white p-4 transition-all hover:border-amber-300 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <Heart className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-stone-900">My Favorites</p>
                <p className="text-sm text-stone-500">Saved content</p>
              </div>
              <ChevronRight className="h-5 w-5 text-stone-400" />
            </Link>
          </div>

          {/* Stats */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Activity
            </h2>
            
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                  <Heart className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-stone-900">
                    {profile?.favorites?.length || 0}
                  </p>
                  <p className="text-sm text-stone-500">Favorites</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                  <Clock className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-stone-900">
                    {profile?.recentlyViewed?.length || 0}
                  </p>
                  <p className="text-sm text-stone-500">Recently Viewed</p>
                </div>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Your Info
            </h2>
            
            <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-4">
              <div>
                <p className="text-xs text-stone-500">Preferred Language</p>
                <p className="font-medium text-stone-900 capitalize">
                  {profile?.preferences?.language || "English"}
                </p>
              </div>
              
              <div>
                <p className="text-xs text-stone-500">Timezone</p>
                <p className="font-medium text-stone-900">
                  {profile?.preferences?.timezone || "Asia/Kolkata"}
                </p>
              </div>
              
              <div>
                <p className="text-xs text-stone-500">Theme</p>
                <p className="font-medium text-stone-900 capitalize">
                  {profile?.preferences?.theme || "System"}
                </p>
              </div>
              
              {profile?.gotra && (
                <div>
                  <p className="text-xs text-stone-500">Gotra</p>
                  <p className="font-medium text-stone-900">{profile.gotra}</p>
                </div>
              )}
              
              {profile?.nakshatra && (
                <div>
                  <p className="text-xs text-stone-500">Nakshatra</p>
                  <p className="font-medium text-stone-900">{profile.nakshatra}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notifications Summary */}
        <div className="mt-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Notification Settings
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { key: "dailyPanchanga", label: "Daily Panchanga" },
              { key: "dailyQuote", label: "Daily Quote" },
              { key: "events", label: "Upcoming Events" },
              { key: "festivals", label: "Festival Reminders" },
              { key: "aaradhane", label: "Aaradhane" },
              { key: "liveStream", label: "Live Darshan" },
              { key: "announcements", label: "Announcements" },
            ].map((item) => (
              <div
                key={item.key}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  profile?.preferences?.notifications?.[item.key as keyof typeof profile.preferences.notifications]
                    ? "border-green-200 bg-green-50"
                    : "border-stone-200 bg-white"
                }`}
              >
                <div className={`h-2 w-2 rounded-full ${
                  profile?.preferences?.notifications?.[item.key as keyof typeof profile.preferences.notifications]
                    ? "bg-green-500"
                    : "bg-stone-300"
                }`} />
                <span className="text-sm font-medium text-stone-700">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/profile/preferences"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-amber-600 hover:text-amber-700"
          >
            Edit notification preferences
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
