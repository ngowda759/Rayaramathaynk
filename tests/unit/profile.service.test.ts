// tests/unit/profile.service.test.ts
import { profileService } from "@/services/profile.service";
import { apiFetch } from "@/lib/api/fetch";
import { getAuthToken } from "@/lib/api/auth-token";

jest.mock("@/lib/api/fetch", () => ({
  apiFetch: jest.fn(),
}));
jest.mock("@/lib/api/auth-token", () => ({
  getAuthToken: jest.fn(),
}));

type DevoteeProfile = {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  templeId: string;
  profileImage: string;
  isApproved: boolean;
  isActive: boolean;
  emailVerified: boolean;
  lastLogin: null | string;
  createdAt: string;
  updatedAt: string;
  favorites: string[];
};

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
      role: "devotee",
      templeId: "main",
      profileImage: "",
      isApproved: false,
      isActive: true,
      emailVerified: true,
      lastLogin: null,
      createdAt: "2020-01-01",
      updatedAt: "2020-01-01",
      favorites: [],
    };
    (apiFetch as jest.Mock).mockResolvedValueOnce({ profile: mockProfile });
    const result = await profileService.getProfile("any");
    expect(apiFetch).toHaveBeenCalledWith<DevoteeProfile>("/api/auth/profile");
    expect(result).toEqual(mockProfile);
  });

  it("saves profile via POST", async () => {
    const payload = { name: "New" } as Partial<DevoteeProfile>;
    (apiFetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    const result = await profileService.saveProfile("uid", payload);
    expect(apiFetch).toHaveBeenCalledWith<DevoteeProfile>("/api/auth/profile", {
      method: "POST",
      body: payload,
    });
    expect(result).toBeDefined();
  });

  it("updates profile via PUT", async () => {
    const payload = { name: "Updated" };
    (apiFetch as jest.Mock).mockResolvedValueOnce(undefined);
    await profileService.updateProfile("uid", payload as any);
    expect(apiFetch).toHaveBeenCalledWith("/api/auth/profile", {
      method: "PUT",
      body: payload,
    });
  });

  it("uploads image using original endpoint", async () => {
    const file = new File(["content"], "test.png", { type: "image/png" });
    (getAuthToken as jest.Mock).mockResolvedValueOnce("token");
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "https://blob.com/img.png" }) });
    // @ts-ignore
    global.fetch = mockFetch;
    const url = await profileService.uploadProfileImage("uid", file);
    expect(mockFetch).toHaveBeenCalledWith("/api/profile/image", expect.objectContaining({ method: "POST" }));
    expect(url).toBe("https://blob.com/img.png");
  });
});
