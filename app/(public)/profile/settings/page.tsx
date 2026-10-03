"use client";

import { useState } from "react";
import { useProfile } from "@/context/ProfileContext";
import { useAuthContext } from "@/context/AuthContext";
import Link from "next/link";
import Image from "next/image";
import toast from "react-hot-toast";
import { 
  ArrowLeft,
  User,
  Camera,
  Trash2,
  Save,
  Loader2,
  Mail,
  Phone
} from "lucide-react";

export default function ProfileSettingsPage() {
  const { profile, isLoading, updateProfile, uploadProfileImage, deleteProfileImage, isAuthenticated } = useProfile();
  const { user } = useAuthContext();

  const [name, setName] = useState(profile?.name || user?.displayName || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [gotra, setGotra] = useState(profile?.gotra || "");
  const [nakshatra, setNakshatra] = useState(profile?.nakshatra || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-stone-50 py-12">
        <div className="mx-auto max-w-2xl px-6">
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
            <p className="text-stone-600">Please sign in to access settings.</p>
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);

    try {
      await updateProfile({
        name,
        phone,
        bio,
        gotra,
        nakshatra,
      });
      toast.success("Profile updated successfully!");
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadProfileImage(file);
      toast.success("Profile photo updated!");
    } catch (error) {
      toast.error("Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteImage() {
    if (!confirm("Are you sure you want to remove your profile photo?")) return;

    try {
      await deleteProfileImage();
      toast.success("Profile photo removed");
    } catch (error) {
      toast.error("Failed to remove photo");
    }
  }

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
          <h1 className="text-3xl font-bold text-stone-900">Account Settings</h1>
          <p className="mt-2 text-stone-600">Manage your account information</p>
        </div>

        {/* Profile Photo */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-stone-900">Profile Photo</h2>
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="h-24 w-24 overflow-hidden rounded-full bg-stone-200">
                {profile?.profileImage || user?.photoURL ? (
                  <Image
                    src={profile?.profileImage || user?.photoURL || ""}
                    alt={profile?.name || "Profile"}
                    width={96}
                    height={96}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <User className="h-10 w-10 text-stone-400" />
                  </div>
                )}
              </div>
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-amber-700">
                <Camera className="h-4 w-4" />
                Upload Photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
              {(profile?.profileImage || user?.photoURL) && (
                <button
                  onClick={handleDeleteImage}
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-4 py-2 font-semibold text-stone-700 transition-colors hover:bg-stone-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Account Info */}
        <form onSubmit={handleSave}>
          <div className="mb-8 overflow-hidden rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-stone-900">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-stone-700">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-stone-300 px-4 py-2.5 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-stone-700">
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                  <input
                    type="email"
                    id="email"
                    value={profile?.email || user?.email || ""}
                    disabled
                    className="block w-full cursor-not-allowed rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 pl-10 text-stone-500"
                  />
                </div>
                <p className="mt-1 text-xs text-stone-500">Email cannot be changed</p>
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-stone-700">
                  Phone Number
                </label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                  <input
                    type="tel"
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="block w-full rounded-xl border border-stone-300 px-4 py-2.5 pl-10 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-stone-700">
                  Bio
                </label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  placeholder="Tell us about yourself..."
                  className="mt-1 block w-full rounded-xl border border-stone-300 px-4 py-2.5 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>
          </div>

          {/* Vedic Info */}
          <div className="mb-8 overflow-hidden rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-stone-900">Vedic Information (Optional)</h2>
            <p className="mb-4 text-sm text-stone-600">
              This information helps us provide personalized spiritual guidance.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="gotra" className="block text-sm font-medium text-stone-700">
                  Gotra
                </label>
                <input
                  type="text"
                  id="gotra"
                  value={gotra}
                  onChange={(e) => setGotra(e.target.value)}
                  placeholder="e.g., Kashyapa"
                  className="mt-1 block w-full rounded-xl border border-stone-300 px-4 py-2.5 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label htmlFor="nakshatra" className="block text-sm font-medium text-stone-700">
                  Nakshatra (Birth Star)
                </label>
                <input
                  type="text"
                  id="nakshatra"
                  value={nakshatra}
                  onChange={(e) => setNakshatra(e.target.value)}
                  placeholder="e.g., Ashwini"
                  className="mt-1 block w-full rounded-xl border border-stone-300 px-4 py-2.5 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-xl disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
