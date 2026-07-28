"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { useAuthContext } from "./AuthContext";
import { profileService } from "@/services/profile.service";
import {
  DevoteeProfile,
  UserPreferences,
  Theme,
  DEFAULT_USER_PREFERENCES,
} from "@/types/profile";
import { Locale } from "@/lib/i18n";
import { useRouter } from "next/navigation";

interface ProfileContextType {
  profile: DevoteeProfile | null;
  preferences: UserPreferences;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Profile actions
  refreshProfile: () => Promise<void>;
  updateProfile: (data: Partial<DevoteeProfile>) => Promise<void>;
  uploadProfileImage: (file: File) => Promise<string>;
  deleteProfileImage: () => Promise<void>;
  
  // Preferences actions
  updateLanguage: (language: Locale) => Promise<void>;
  updateTimezone: (timezone: string) => Promise<void>;
  updateTheme: (theme: Theme) => Promise<void>;
  updateNotificationPreferences: (prefs: Partial<UserPreferences["notifications"]>) => Promise<void>;
  updateDevicePreferences: (prefs: Partial<UserPreferences["device"]>) => Promise<void>;
  
  // Favorites
  addFavorite: (itemId: string) => Promise<void>;
  removeFavorite: (itemId: string) => Promise<void>;
  isFavorited: (itemId: string) => boolean;
  
  // Recently viewed
  addRecentlyViewed: (itemId: string) => Promise<void>;
  
  // Bookmarks
  addBookmark: (bookmark: { type: string; itemId: string; title: string; description?: string; thumbnail?: string; url: string }) => Promise<void>;
  removeBookmark: (bookmarkId: string) => Promise<void>;
  getBookmarks: (type?: string) => Promise<any[]>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user, loading: authLoading } = useAuthContext();
  const router = useRouter();
  
  const [profile, setProfile] = useState<DevoteeProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  // Load profile when user changes
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- State initialization
      setProfile(null);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- State initialization
      setPreferences(DEFAULT_USER_PREFERENCES);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- State initialization
      setIsLoading(false);
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Data fetching pattern
    loadProfile();
  }, [user, authLoading]);

  async function loadProfile() {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const profileData = await profileService.getProfile(user.uid);
      
      if (profileData) {
        setProfile(profileData);
        setPreferences(profileData.preferences);
      } else {
        // Create new profile if doesn't exist
        await profileService.saveProfile(user.uid, {
          name: user.displayName || "",
          email: user.email || "",
          profileImage: user.photoURL || "",
        });
        
        const newProfile = await profileService.getProfile(user.uid);
        setProfile(newProfile);
        if (newProfile) {
          setPreferences(newProfile.preferences);
        }
      }
    } catch (error) {
      console.error("[ProfileContext] Error loading profile:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshProfile() {
    await loadProfile();
  }

  async function updateProfile(data: Partial<DevoteeProfile>) {
    if (!user) return;
    
    await profileService.updateProfile(user.uid, data);
    await loadProfile();
  }

  async function uploadProfileImage(file: File) {
    if (!user) throw new Error("Not authenticated");
    
    const url = await profileService.uploadProfileImage(user.uid, file);
    await loadProfile();
    return url;
  }

  async function deleteProfileImage() {
    if (!user) return;
    
    await profileService.deleteProfileImage(user.uid);
    await loadProfile();
  }

  async function updateLanguage(language: Locale) {
    if (!user) return;
    
    await profileService.updatePreferences(user.uid, { language });
    setPreferences((prev) => ({ ...prev, language }));
  }

  async function updateTimezone(timezone: string) {
    if (!user) return;
    
    await profileService.updatePreferences(user.uid, { timezone });
    setPreferences((prev) => ({ ...prev, timezone }));
  }

  async function updateTheme(theme: Theme) {
    if (!user) return;
    
    await profileService.updatePreferences(user.uid, { theme });
    setPreferences((prev) => ({ ...prev, theme }));
  }

  async function updateNotificationPreferences(
    prefs: Partial<UserPreferences["notifications"]>
  ) {
    if (!user) return;
    
    await profileService.updatePreferences(user.uid, { notifications: prefs });
    setPreferences((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, ...prefs },
    }));
  }

  async function updateDevicePreferences(
    prefs: Partial<UserPreferences["device"]>
  ) {
    if (!user) return;
    
    await profileService.updatePreferences(user.uid, { device: prefs });
    setPreferences((prev) => ({
      ...prev,
      device: { ...prev.device, ...prefs },
    }));
  }

  async function addFavorite(itemId: string) {
    if (!user) return;
    
    await profileService.addFavorite(user.uid, itemId);
    await loadProfile();
  }

  async function removeFavorite(itemId: string) {
    if (!user) return;
    
    await profileService.removeFavorite(user.uid, itemId);
    await loadProfile();
  }

  function isFavorited(itemId: string): boolean {
    return profile?.favorites.includes(itemId) || false;
  }

  async function addRecentlyViewed(itemId: string) {
    if (!user) return;
    
    await profileService.addRecentlyViewed(user.uid, itemId);
  }

  async function addBookmark(bookmark: { type: string; itemId: string; title: string; description?: string; thumbnail?: string; url: string }) {
    if (!user) return;
    
    await profileService.addBookmark(user.uid, bookmark as any);
  }

  async function removeBookmark(bookmarkId: string) {
    if (!user) return;
    
    await profileService.removeBookmark(user.uid, bookmarkId);
  }

  async function getBookmarks(type?: string) {
    if (!user) return [];
    
    return profileService.getBookmarks(user.uid, type as any);
  }

  return (
    <ProfileContext.Provider
      value={{
        profile,
        preferences,
        isLoading,
        isAuthenticated: !!user,
        refreshProfile,
        updateProfile,
        uploadProfileImage,
        deleteProfileImage,
        updateLanguage,
        updateTimezone,
        updateTheme,
        updateNotificationPreferences,
        updateDevicePreferences,
        addFavorite,
        removeFavorite,
        isFavorited,
        addRecentlyViewed,
        addBookmark,
        removeBookmark,
        getBookmarks,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  
  if (context === undefined) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  
  return context;
}
