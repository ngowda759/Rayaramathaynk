import "server-only";

/**
 * Profile Service - Devotee profile management
 *
 * Profiles live in Supabase `profiles`. There is no Firestore path and no Firestore
 * Storage path: profile images are uploaded to Vercel Blob through the existing
 * `storageService`, the same mechanism gallery and testimonial images already use.
 *
 * Reads use the public client; writes use the service-role admin client because
 * `profiles` is deny-all under RLS. A read failure throws so the caller sees a real
 * error rather than a silently empty profile.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  DevoteeProfile,
  ProfileUpdateData,
  PreferencesUpdateData,
  Bookmark,
  BookmarkType,
  DEFAULT_USER_PREFERENCES,
} from "@/types/profile";
import { Locale } from "@/lib/i18n";

const TABLE = "profiles";

/** Convert a Supabase `profiles` row to `DevoteeProfile`. */
function rowToProfile(row: any): DevoteeProfile {
  return {
    uid: row.firestore_id || row.uid || row.id,
    name: row.name || "",
    email: row.email || "",
    phone: row.phone || "",
    profileImage: row.profile_image || "",
    bio: row.bio || "",
    gotra: row.gotra || "",
    nakshatra: row.nakshatra || "",
    preferences: {
      language: (row.preferences?.language as Locale) || DEFAULT_USER_PREFERENCES.language,
      timezone: row.preferences?.timezone || DEFAULT_USER_PREFERENCES.timezone,
      theme: row.preferences?.theme || DEFAULT_USER_PREFERENCES.theme,
      notifications: {
        ...DEFAULT_USER_PREFERENCES.notifications,
        ...row.preferences?.notifications,
      },
      device: {
        ...DEFAULT_USER_PREFERENCES.device,
        ...row.preferences?.device,
      },
    },
    favorites: row.favorites || [],
    recentlyViewed: row.recently_viewed || [],
    bookmarks: (row.bookmarks || []).map((b: any) => ({
      ...b,
      createdAt: b.createdAt ? new Date(b.createdAt) : new Date(),
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class ProfileService {
  async getProfile(uid: string): Promise<DevoteeProfile | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("firestore_id", uid)
      .maybeSingle();
    if (error) throw new Error(`Could not read profile: ${error.message}`);
    return data ? rowToProfile(data) : null;
  }

  async saveProfile(
    uid: string,
    data: Partial<DevoteeProfile>,
    email?: string
  ): Promise<DevoteeProfile> {
    const existing = await this.getProfile(uid);

    const preferences = {
      ...DEFAULT_USER_PREFERENCES,
      ...(existing?.preferences || {}),
      ...(data.preferences || {}),
    };

    const supabase = createAdminClient();
    const { error } = await supabase.from(TABLE).upsert(
      {
        firestore_id: uid,
        uid,
        name: data.name ?? existing?.name ?? "",
        email: email || data.email || existing?.email || "",
        phone: data.phone ?? existing?.phone ?? "",
        profile_image: data.profileImage ?? existing?.profileImage ?? "",
        bio: data.bio ?? existing?.bio ?? "",
        gotra: data.gotra ?? existing?.gotra ?? "",
        nakshatra: data.nakshatra ?? existing?.nakshatra ?? "",
        preferences,
        favorites: data.favorites ?? existing?.favorites ?? [],
        recently_viewed: data.recentlyViewed ?? existing?.recentlyViewed ?? [],
        bookmarks: data.bookmarks ?? existing?.bookmarks ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "firestore_id" }
    );
    if (error) throw new Error(`Could not save profile: ${error.message}`);

    const saved = await this.getProfile(uid);
    if (!saved) throw new Error("Profile was saved but could not be re-read");
    return saved;
  }

  async updateProfile(uid: string, data: ProfileUpdateData): Promise<void> {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) update.name = data.name;
    if (data.phone !== undefined) update.phone = data.phone;
    if (data.profileImage !== undefined) update.profile_image = data.profileImage;
    if (data.bio !== undefined) update.bio = data.bio;
    if (data.gotra !== undefined) update.gotra = data.gotra;
    if (data.nakshatra !== undefined) update.nakshatra = data.nakshatra;

    const supabase = createAdminClient();
    const { error } = await supabase.from(TABLE).update(update).eq("firestore_id", uid);
    if (error) throw new Error(`Could not update profile: ${error.message}`);
  }

  async updatePreferences(uid: string, data: PreferencesUpdateData): Promise<void> {
    const profile = await this.getProfile(uid);
    if (!profile) throw new Error("Profile not found");

    const preferences: DevoteeProfile["preferences"] = {
      ...profile.preferences,
      ...(data.language !== undefined ? { language: data.language } : {}),
      ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
      ...(data.theme !== undefined ? { theme: data.theme } : {}),
      ...(data.notifications !== undefined
        ? { notifications: { ...profile.preferences.notifications, ...data.notifications } }
        : {}),
      ...(data.device !== undefined
        ? { device: { ...profile.preferences.device, ...data.device } }
        : {}),
    };

    const supabase = createAdminClient();
    const { error } = await supabase
      .from(TABLE)
      .update({ preferences, updated_at: new Date().toISOString() })
      .eq("firestore_id", uid);
    if (error) throw new Error(`Could not update preferences: ${error.message}`);
  }

  async uploadProfileImage(uid: string, file: File): Promise<string> {
    const { storageService } = await import("@/services/storage.service");

    const existing = await this.getProfile(uid);
    if (existing?.profileImage) {
      await storageService.deleteFile(existing.profileImage).catch(() => undefined);
    }

    const extension = file.name.split(".").pop() || "jpg";
    const filename = `${uid}_${Date.now()}.${extension}`;
    const result = await storageService.uploadFile(file, filename, "profile");

    await this.updateProfile(uid, { profileImage: result.url });
    return result.url;
  }

  async deleteProfileImage(uid: string): Promise<void> {
    const { storageService } = await import("@/services/storage.service");

    const profile = await this.getProfile(uid);
    if (profile?.profileImage) {
      await storageService.deleteFile(profile.profileImage).catch(() => undefined);
      await this.updateProfile(uid, { profileImage: "" });
    }
  }

  private async writeList(uid: string, column: string, values: string[]): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from(TABLE)
      .update({ [column]: values, updated_at: new Date().toISOString() })
      .eq("firestore_id", uid);
    if (error) throw new Error(`Could not update profile: ${error.message}`);
  }

  async addFavorite(uid: string, itemId: string): Promise<void> {
    const profile = await this.getProfile(uid);
    const favorites = Array.from(new Set([...(profile?.favorites || []), itemId]));
    await this.writeList(uid, "favorites", favorites);
  }

  async removeFavorite(uid: string, itemId: string): Promise<void> {
    const profile = await this.getProfile(uid);
    const favorites = (profile?.favorites || []).filter((id) => id !== itemId);
    await this.writeList(uid, "favorites", favorites);
  }

  async addRecentlyViewed(uid: string, itemId: string): Promise<void> {
    const profile = await this.getProfile(uid);
    const recentlyViewed = [
      itemId,
      ...(profile?.recentlyViewed || []).filter((id) => id !== itemId),
    ].slice(0, 20);
    await this.writeList(uid, "recently_viewed", recentlyViewed);
  }

  async addBookmark(
    uid: string,
    bookmark: Omit<Bookmark, "id" | "createdAt">
  ): Promise<Bookmark> {
    const profile = await this.getProfile(uid);
    const created: Bookmark = {
      ...bookmark,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      createdAt: new Date(),
    };
    const bookmarks = [...(profile?.bookmarks || []), created];

    const supabase = createAdminClient();
    const { error } = await supabase
      .from(TABLE)
      .update({ bookmarks, updated_at: new Date().toISOString() })
      .eq("firestore_id", uid);
    if (error) throw new Error(`Could not add bookmark: ${error.message}`);
    return created;
  }

  async removeBookmark(uid: string, bookmarkId: string): Promise<void> {
    const profile = await this.getProfile(uid);
    const bookmarks = (profile?.bookmarks || []).filter((b) => b.id !== bookmarkId);

    const supabase = createAdminClient();
    const { error } = await supabase
      .from(TABLE)
      .update({ bookmarks, updated_at: new Date().toISOString() })
      .eq("firestore_id", uid);
    if (error) throw new Error(`Could not remove bookmark: ${error.message}`);
  }

  async getBookmarks(uid: string, type?: BookmarkType): Promise<Bookmark[]> {
    const profile = await this.getProfile(uid);
    const bookmarks = profile?.bookmarks || [];
    return type ? bookmarks.filter((b) => b.type === type) : bookmarks;
  }

  async isFavorited(uid: string, itemId: string): Promise<boolean> {
    const profile = await this.getProfile(uid);
    return profile?.favorites.includes(itemId) || false;
  }
}

export const profileService = new ProfileService();
