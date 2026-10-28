import { apiFetch } from "@/lib/api/fetch";
import { getAuthToken } from "@/lib/api/auth-token";
import {
  DevoteeProfile,
  ProfileUpdateData,
  PreferencesUpdateData,
  Bookmark,
  BookmarkType,
} from "@/types/profile";

/**
 * Devotee profiles, stored in Supabase `profiles`.
 *
 * `profiles` is deny-all under RLS, so the browser never reads the table directly.
 * Every call goes through the signed-in user's own `/api/profile` routes, which verify
 * the Firebase ID token and derive the profile key from the token's `uid` — the caller
 * can only ever reach their own profile. Profile images go to Vercel Blob through
 * `storageService`; there is no Firestore path.
 *
 * The `uid` argument is kept for call-site compatibility; the server ignores it and
 * uses the verified token identity.
 */
class ProfileService {
  async getProfile(_uid: string): Promise<DevoteeProfile | null> {
    try {
      return await apiFetch<DevoteeProfile>("/api/profile");
    } catch {
      return null;
    }
  }

  async saveProfile(_uid: string, data: Partial<DevoteeProfile>): Promise<DevoteeProfile> {
    return apiFetch<DevoteeProfile>("/api/profile", { method: "POST", body: data });
  }

  async updateProfile(_uid: string, data: ProfileUpdateData): Promise<void> {
    await apiFetch("/api/profile", { method: "PUT", body: data });
  }

  async updatePreferences(_uid: string, data: PreferencesUpdateData): Promise<void> {
    await apiFetch("/api/profile/preferences", { method: "PUT", body: data });
  }

  async uploadProfileImage(_uid: string, file: File): Promise<string> {
    const token = await getAuthToken();
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/profile/image", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!response.ok) throw new Error(`Failed to upload profile image (${response.status})`);
    const { url } = (await response.json()) as { url: string };
    return url;
  }

  async deleteProfileImage(_uid: string): Promise<void> {
    await apiFetch("/api/profile/image", { method: "DELETE" });
  }

  async addFavorite(_uid: string, itemId: string): Promise<void> {
    await apiFetch("/api/profile/favorites", { method: "POST", body: { itemId } });
  }

  async removeFavorite(_uid: string, itemId: string): Promise<void> {
    await apiFetch("/api/profile/favorites", { method: "DELETE", body: { itemId } });
  }

  async addRecentlyViewed(_uid: string, itemId: string): Promise<void> {
    await apiFetch("/api/profile/recently-viewed", { method: "POST", body: { itemId } });
  }

  async addBookmark(_uid: string, bookmark: Omit<Bookmark, "id" | "createdAt">): Promise<Bookmark> {
    return apiFetch<Bookmark>("/api/profile/bookmarks", { method: "POST", body: bookmark });
  }

  async removeBookmark(_uid: string, bookmarkId: string): Promise<void> {
    await apiFetch("/api/profile/bookmarks", { method: "DELETE", body: { bookmarkId } });
  }

  async getBookmarks(_uid: string, type?: BookmarkType): Promise<Bookmark[]> {
    const query = type ? `?type=${encodeURIComponent(type)}` : "";
    return apiFetch<Bookmark[]>(`/api/profile/bookmarks${query}`);
  }

  async isFavorited(_uid: string, itemId: string): Promise<boolean> {
    const profile = await this.getProfile(_uid);
    return profile?.favorites.includes(itemId) || false;
  }
}

export const profileService = new ProfileService();
