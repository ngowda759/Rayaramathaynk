// Set env vars before any imports
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost";
process.env.SUPABASE_SERVICE_ROLE_KEY = "dummy_key";

import { seedAISettings } from "@/scripts/seed-ai-settings-supabase";
import { createClient } from "@supabase/supabase-js";

// Mock Supabase client
jest.mock("@supabase/supabase-js", () => {
  const mClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
  };
  return { createClient: jest.fn(() => mClient) };
});

describe("seedAISettings idempotency", () => {
  let mockSupabase: any;
  let exitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createClient("url", "key");
    exitSpy = jest.spyOn(process, "exit").mockImplementation((() => {}) as any);
  });

  afterAll(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    exitSpy.mockRestore();
  });

  it("should insert with onConflict: 'id', ignoreDuplicates: true", async () => {
    // Mock the upsert() call to return no error (simulating successful upsert)
    mockSupabase.upsert.mockResolvedValueOnce({ error: null });

    // Spy on console.log
    const spyLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    await seedAISettings();

    // Verify upsert was called with the correct idempotency constraints
    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'main' }),
      expect.objectContaining({ onConflict: 'id', ignoreDuplicates: true })
    );
    spyLog.mockRestore();
  });

  it("should call process.exit(1) if upsert fails but returns an error", async () => {
    // Mock the upsert() call to return an error (simulating failed upsert)
    mockSupabase.upsert.mockResolvedValueOnce({ error: new Error("Upsert error") });

    // Silence console error
    const spyErr = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spyLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    await seedAISettings();

    expect(mockSupabase.upsert).toHaveBeenCalled();
    expect(spyErr).toHaveBeenCalledWith(expect.stringContaining("Error seeding ai_settings"), expect.any(Error));
    expect(exitSpy).toHaveBeenCalledWith(1);

    spyErr.mockRestore();
    spyLog.mockRestore();
  });
});
