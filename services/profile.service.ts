/**
 * Profile Service - Devotee profile management
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  FirestoreError,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import {
  DevoteeProfile,
  ProfileUpdateData,
  PreferencesUpdateData,
  Bookmark,
  BookmarkType,
  DEFAULT_USER_PREFERENCES,
} from "@/types/profile";
import { Locale } from "@/lib/i18n";

const PROFILE_COLLECTION = "profiles";
const BOOKMARKS_COLLECTION = "bookmarks";

/**
 * Convert Firestore document to DevoteeProfile
 */
function docToProfile(id: string, data: any): DevoteeProfile {
  return {
    uid: id,
    name: data.name || "",
    email: data.email || "",
    phone: data.phone || "",
    profileImage: data.profileImage || "",
    bio: data.bio || "",
    gotra: data.gotra || "",
    nakshatra: data.nakshatra || "",
    preferences: {
      language: (data.preferences?.language as Locale) || DEFAULT_USER_PREFERENCES.language,
      timezone: data.preferences?.timezone || DEFAULT_USER_PREFERENCES.timezone,
      theme: data.preferences?.theme || DEFAULT_USER_PREFERENCES.theme,
      notifications: {
        ...DEFAULT_USER_PREFERENCES.notifications,
        ...data.preferences?.notifications,
      },
      device: {
        ...DEFAULT_USER_PREFERENCES.device,
        ...data.preferences?.device,
      },
    },
    favorites: data.favorites || [],
    recentlyViewed: data.recentlyViewed || [],
    bookmarks: data.bookmarks || [],
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

class ProfileService {
  /**
   * Get user profile by UID
   */
  async getProfile(uid: string): Promise<DevoteeProfile | null> {
    if (!db) {
      console.log("[ProfileService] Firebase not configured");
      return null;
    }

    try {
      const docRef = doc(db, PROFILE_COLLECTION, uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return docToProfile(docSnap.id, docSnap.data());
    } catch (error) {
      console.error("[ProfileService] Error getting profile:", error);
      throw error;
    }
  }

  /**
   * Create or update profile
   */
  async saveProfile(
    uid: string,
    data: Partial<DevoteeProfile>,
    email?: string
  ): Promise<DevoteeProfile> {
    if (!db) {
      console.log("[ProfileService] Firebase not configured");
      throw new Error("Firebase not configured");
    }

    try {
      const docRef = doc(db, PROFILE_COLLECTION, uid);
      const existingDoc = await getDoc(docRef);

      const profileData = {
        ...data,
        email: email || data.email,
        preferences: {
          ...DEFAULT_USER_PREFERENCES,
          ...(existingDoc.data()?.preferences || {}),
          ...(data.preferences || {}),
        },
        updatedAt: serverTimestamp(),
        ...(existingDoc.exists() ? {} : { createdAt: serverTimestamp() }),
      };

      await setDoc(docRef, profileData, { merge: true });

      return docToProfile(uid, profileData);
    } catch (error) {
      console.error("[ProfileService] Error saving profile:", error);
      throw error;
    }
  }

  /**
   * Update profile basic info
   */
  async updateProfile(uid: string, data: ProfileUpdateData): Promise<void> {
    if (!db) {
      console.log("[ProfileService] Firebase not configured");
      return;
    }

    try {
      const docRef = doc(db, PROFILE_COLLECTION, uid);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("[ProfileService] Error updating profile:", error);
      throw error;
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(uid: string, data: PreferencesUpdateData): Promise<void> {
    if (!db) {
      console.log("[ProfileService] Firebase not configured");
      return;
    }

    try {
      const docRef = doc(db, PROFILE_COLLECTION, uid);
      const updates: Record<string, any> = {
        updatedAt: serverTimestamp(),
      };

      if (data.language !== undefined) {
        updates["preferences.language"] = data.language;
      }
      if (data.timezone !== undefined) {
        updates["preferences.timezone"] = data.timezone;
      }
      if (data.theme !== undefined) {
        updates["preferences.theme"] = data.theme;
      }
      if (data.notifications !== undefined) {
        Object.entries(data.notifications).forEach(([key, value]) => {
          updates[`preferences.notifications.${key}`] = value;
        });
      }
      if (data.device !== undefined) {
        Object.entries(data.device).forEach(([key, value]) => {
          updates[`preferences.device.${key}`] = value;
        });
      }

      await updateDoc(docRef, updates);
    } catch (error) {
      console.error("[ProfileService] Error updating preferences:", error);
      throw error;
    }
  }

  /**
   * Upload profile image
   */
  async uploadProfileImage(uid: string, file: File): Promise<string> {
    if (!storage) {
      console.log("[ProfileService] Firebase storage not configured");
      throw new Error("Firebase storage not configured");
    }

    try {
      // Delete existing image if any
      const existingProfile = await this.getProfile(uid);
      if (existingProfile?.profileImage) {
        try {
          const existingRef = ref(storage, existingProfile.profileImage);
          await deleteObject(existingRef);
        } catch {
          // Ignore deletion errors
        }
      }

      // Upload new image
      const fileExtension = file.name.split(".").pop() || "jpg";
      const fileName = `profiles/${uid}/${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, fileName);

      const metadata = {
        contentType: file.type,
        customMetadata: {
          uploadedBy: uid,
        },
      };

      await uploadBytes(storageRef, file, metadata);
      const downloadURL = await getDownloadURL(storageRef);

      // Update profile with new image URL
      await this.updateProfile(uid, { profileImage: downloadURL });

      return downloadURL;
    } catch (error) {
      console.error("[ProfileService] Error uploading profile image:", error);
      throw error;
    }
  }

  /**
   * Delete profile image
   */
  async deleteProfileImage(uid: string): Promise<void> {
    if (!storage) {
      console.log("[ProfileService] Firebase storage not configured");
      return;
    }

    try {
      const profile = await this.getProfile(uid);
      if (profile?.profileImage) {
        const imageRef = ref(storage, profile.profileImage);
        await deleteObject(imageRef);
        await this.updateProfile(uid, { profileImage: "" });
      }
    } catch (error) {
      console.error("[ProfileService] Error deleting profile image:", error);
      throw error;
    }
  }

  /**
   * Add to favorites
   */
  async addFavorite(uid: string, itemId: string): Promise<void> {
    if (!db) return;

    try {
      const docRef = doc(db, PROFILE_COLLECTION, uid);
      await updateDoc(docRef, {
        favorites: [...(await this.getProfile(uid))?.favorites || [], itemId],
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("[ProfileService] Error adding favorite:", error);
      throw error;
    }
  }

  /**
   * Remove from favorites
   */
  async removeFavorite(uid: string, itemId: string): Promise<void> {
    if (!db) return;

    try {
      const profile = await this.getProfile(uid);
      const favorites = profile?.favorites.filter((id) => id !== itemId) || [];
      
      const docRef = doc(db, PROFILE_COLLECTION, uid);
      await updateDoc(docRef, {
        favorites,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("[ProfileService] Error removing favorite:", error);
      throw error;
    }
  }

  /**
   * Add to recently viewed
   */
  async addRecentlyViewed(uid: string, itemId: string): Promise<void> {
    if (!db) return;

    try {
      const profile = await this.getProfile(uid);
      const recentlyViewed = [
        itemId,
        ...((profile?.recentlyViewed || []).filter((id) => id !== itemId)),
      ].slice(0, 20); // Keep last 20

      const docRef = doc(db, PROFILE_COLLECTION, uid);
      await updateDoc(docRef, {
        recentlyViewed,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("[ProfileService] Error adding recently viewed:", error);
      throw error;
    }
  }

  /**
   * Add bookmark
   */
  async addBookmark(uid: string, bookmark: Omit<Bookmark, "id" | "createdAt">): Promise<Bookmark> {
    if (!db) {
      throw new Error("Firebase not configured");
    }

    try {
      const bookmarksRef = collection(db, BOOKMARKS_COLLECTION);
      const bookmarkData = {
        ...bookmark,
        uid,
        createdAt: serverTimestamp(),
      };

      const docRef = doc(bookmarksRef);
      await setDoc(docRef, bookmarkData);
      
      return {
        ...bookmark,
        id: docRef.id || `${Date.now()}`,
        createdAt: new Date(),
      };
    } catch (error) {
      console.error("[ProfileService] Error adding bookmark:", error);
      throw error;
    }
  }

  /**
   * Remove bookmark
   */
  async removeBookmark(uid: string, bookmarkId: string): Promise<void> {
    if (!db) return;

    try {
      const q = query(
        collection(db, BOOKMARKS_COLLECTION),
        where("uid", "==", uid),
        where("itemId", "==", bookmarkId)
      );
      const snapshot = await getDocs(q);

      for (const docSnap of snapshot.docs) {
        await deleteDoc(docSnap.ref);
      }
    } catch (error) {
      console.error("[ProfileService] Error removing bookmark:", error);
      throw error;
    }
  }

  /**
   * Get user bookmarks
   */
  async getBookmarks(uid: string, type?: BookmarkType): Promise<Bookmark[]> {
    if (!db) return [];

    try {
      let q = query(collection(db, BOOKMARKS_COLLECTION), where("uid", "==", uid));
      
      if (type) {
        q = query(collection(db, BOOKMARKS_COLLECTION), where("uid", "==", uid), where("type", "==", type));
      }

      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      })) as Bookmark[];
    } catch (error) {
      console.error("[ProfileService] Error getting bookmarks:", error);
      throw error;
    }
  }

  /**
   * Check if item is favorited
   */
  async isFavorited(uid: string, itemId: string): Promise<boolean> {
    const profile = await this.getProfile(uid);
    return profile?.favorites.includes(itemId) || false;
  }
}

export const profileService = new ProfileService();
