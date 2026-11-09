// tests/unit/profile.service.test.ts
import { profileService } from "@/services/profile.service";
import { apiFetch } from "@/lib/api/fetch";
import { getAuthToken } from "@/lib/api/auth-token";
import type { DevoteeProfile, ProfileUpdateData } from "@/types/profile";

jest.mock("@/lib/api/fetch", () => ({
  apiFetch: jest.fn(),
}));
jest.mock("@/lib/api/auth-token", () => ({
  getAuthToken: jest.fn(),
}));

describe("profileService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("gets profile via /api/auth/profile", async () => {
    const mockProfile: DevoteeProfile = {
      uid: "123",
      name: "Test",
      email: "test@example.com",
      phone: "",
      profileImage: "",
      preferences: {
        language: "en",
        timezone: "UTC",
        theme: "light",
        notifications: {
          email: true,
          push: true,
          dailyPanchanga: true,
          dailyQuote: true,
          events: true,
          festivals: true,
          liveStream: true,
          aaradhane: true,
          announcements: true,
        },
        device: {
          notificationsEnabled: true,
          soundEnabled: true,
          vibrationEnabled: true,
          autoPlayVideo: true,
          highQualityImages: true,
        },
      },
      favorites: [],
      recentlyViewed: [],
      bookmarks: [],
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-01T00:00:00.000Z",
    };
    (apiFetch as jest.Mock).mockResolvedValueOnce({ profile: mockProfile });
    const result = await profileService.getProfile("any");
    expect(apiFetch).toHaveBeenCalledWith("/api/auth/profile");
    expect(result).toEqual(mockProfile);
  });

  it("saves profile via POST", async () => {
    const payload: Partial<DevoteeProfile> = { name: "New" };
    (apiFetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    const result = await profileService.saveProfile("uid", payload);
    expect(apiFetch).toHaveBeenCalledWith("/api/auth/profile", {
      method: "POST",
      body: payload,
    });
    expect(result).toBeDefined();
  });

  it("updates profile via PUT", async () => {
    const payload: ProfileUpdateData = { name: "Updated" };
    (apiFetch as jest.Mock).mockResolvedValueOnce(undefined);
    await profileService.updateProfile("uid", payload);
    expect(apiFetch).toHaveBeenCalledWith("/api/auth/profile", {
      method: "PUT",
      body: payload,
    });
  });

  it("uploads image using original endpoint", async () => {
    const file = new File(["content"], "test.png", { type: "image/png" });
    (getAuthToken as jest.Mock).mockResolvedValueOnce("token");
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://blob.com/img.png" }),
    });
    const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(mockFetch as unknown as typeof fetch);
    const url = await profileService.uploadProfileImage("uid", file);
    expect(mockFetch).toHaveBeenCalledWith("/api/profile/image", expect.objectContaining({ method: "POST" }));
    expect(url).toBe("https://blob.com/img.png");
    fetchSpy.mockRestore();
  });
});
