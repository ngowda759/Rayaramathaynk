import { GET } from "@/app/api/ai/public-settings/route";
import { aiSettingsService } from "@/lib/ai/ai-settings";

jest.mock("@/lib/ai/ai-settings", () => ({
  aiSettingsService: {
    getAIResponses: jest.fn(),
  },
}));

// Mock NextRequest and NextResponse since Jest doesn't have them in its environment by default
const mockJson = jest.fn();
jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn().mockImplementation((body, init) => {
      return {
        status: init?.status || 200,
        json: async () => body,
      };
    }),
  },
}));


describe("GET /api/ai/public-settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the welcome message successfully", async () => {
    (aiSettingsService.getAIResponses as jest.Mock).mockResolvedValue({
      welcome: "Welcome from the database!",
    });

    // We can just pass anything that satisfies the type if it isn't used
    const request = {} as any;
    const response = await GET(request) as any;

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.welcome).toBe("Welcome from the database!");
    expect(aiSettingsService.getAIResponses).toHaveBeenCalledTimes(1);
  });

  it("should return empty welcome if not present in database", async () => {
    (aiSettingsService.getAIResponses as jest.Mock).mockResolvedValue({});

    const request = {} as any;
    const response = await GET(request) as any;

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.welcome).toBeUndefined();
    expect(aiSettingsService.getAIResponses).toHaveBeenCalledTimes(1);
  });

  it("should handle errors gracefully", async () => {
    (aiSettingsService.getAIResponses as jest.Mock).mockRejectedValue(
      new Error("Database error")
    );

    // Silence console error
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const request = {} as any;
    const response = await GET(request) as any;

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("Failed to fetch AI settings");

    spy.mockRestore();
  });
});
