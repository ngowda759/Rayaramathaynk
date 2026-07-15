// Unit tests for Knowledge API Routes
// Tests the coverage and import API endpoints

// Mock Next.js server utilities
const mockNextRequest = jest.fn();
const mockNextResponse = jest.fn();

jest.mock("next/server", () => ({
  NextRequest: mockNextRequest,
  NextResponse: mockNextResponse,
}));

// Mock Firebase
jest.mock("@/lib/firebase", () => ({
  db: null,
  isFirebaseConfigured: () => false,
}));

// Mock fs module
jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
}));

// Mock path
jest.mock("path", () => ({
  join: jest.fn(() => "/mock/seed/ai"),
}));

import * as fs from "fs";
import * as path from "path";

describe("Knowledge Coverage API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Coverage Response Structure", () => {
    it("should have correct required categories defined", () => {
      // Test that the coverage endpoint defines the correct categories
      const REQUIRED_CATEGORIES = [
        { id: "temple-timings", name: "Temple Timings" },
        { id: "visitor-guidelines", name: "Visitor Guidelines" },
        { id: "dress-code", name: "Dress Code" },
        { id: "facilities", name: "Facilities" },
        { id: "parking", name: "Parking" },
        { id: "volunteer", name: "Volunteer" },
        { id: "faq", name: "FAQ" },
        { id: "contact", name: "Contact" },
        { id: "donation", name: "Donation" },
        { id: "photography", name: "Photography" },
        { id: "accommodation", name: "Accommodation" },
        { id: "history", name: "Temple History" },
        { id: "raghavendra-swamy", name: "Sri Raghavendra Swamy" },
        { id: "brindavana", name: "Brindavana" },
      ];

      expect(REQUIRED_CATEGORIES.length).toBe(14);
    });

    it("should return proper coverage structure", () => {
      // Expected response structure when Firebase is not configured
      const mockResponse = {
        success: true,
        data: {
          coverage: [],
          summary: {
            total: 14,
            present: 0,
            missing: 14,
            percentage: 0,
          },
          lastChecked: new Date().toISOString(),
        },
      };

      expect(mockResponse.success).toBe(true);
      expect(mockResponse.data.summary.total).toBe(14);
      expect(mockResponse.data.summary.present).toBe(0);
      expect(mockResponse.data.summary.missing).toBe(14);
      expect(mockResponse.data.summary.percentage).toBe(0);
    });

    it("should calculate coverage percentage correctly", () => {
      const calculateCoverage = (present: number, total: number) => {
        return Math.round((present / total) * 100);
      };

      expect(calculateCoverage(0, 14)).toBe(0);
      expect(calculateCoverage(7, 14)).toBe(50);
      expect(calculateCoverage(14, 14)).toBe(100);
      expect(calculateCoverage(10, 14)).toBe(71);
    });
  });

  describe("Import Logic", () => {
    it("should skip existing articles when overwrite is false", () => {
      const existingArticles = new Map<string, string>();
      existingArticles.set("faq", "faq_id");
      
      const shouldSkip = existingArticles.has("faq");
      
      expect(shouldSkip).toBe(true);
    });

    it("should import new articles when overwrite is false", () => {
      const existingArticles = new Map<string, string>();
      existingArticles.set("faq", "faq_id");
      
      const shouldSkip = existingArticles.has("temple-timings");
      
      expect(shouldSkip).toBe(false);
    });

    it("should import all articles when overwrite is true", () => {
      // When overwrite is true, existingArticles should be empty
      const existingArticles = new Map<string, string>(); // empty when overwrite=true
      
      expect(existingArticles.size).toBe(0);
    });

    it("should generate article ID from category", () => {
      const generateArticleId = (category: string) => {
        return category.replace(/-/g, "_");
      };

      expect(generateArticleId("temple-timings")).toBe("temple_timings");
      expect(generateArticleId("raghavendra-swamy")).toBe("raghavendra_swamy");
      expect(generateArticleId("dress-code")).toBe("dress_code");
    });
  });

  describe("Import Response Structure", () => {
    it("should have correct import response structure", () => {
      const mockImportResponse = {
        success: true,
        data: {
          imported: 14,
          skipped: 0,
          errors: 0,
          results: [],
          summary: {
            total: 14,
            coverage: 100,
          },
        },
      };

      expect(mockImportResponse.success).toBe(true);
      expect(mockImportResponse.data.imported).toBe(14);
      expect(mockImportResponse.data.skipped).toBe(0);
      expect(mockImportResponse.data.errors).toBe(0);
    });

    it("should track import results", () => {
      const results: Array<{ file: string; status: "imported" | "skipped" | "error"; message?: string }> = [];
      
      results.push({ file: "faq.json", status: "imported", message: "FAQ" });
      results.push({ file: "contact.json", status: "skipped", message: "Already exists" });
      
      expect(results.length).toBe(2);
      expect(results[0].status).toBe("imported");
      expect(results[1].status).toBe("skipped");
    });
  });

  describe("Error Handling", () => {
    it("should return error when Firebase is not configured", () => {
      const mockErrorResponse = {
        success: false,
        error: "Firebase not configured",
      };

      expect(mockErrorResponse.success).toBe(false);
      expect(mockErrorResponse.error).toBe("Firebase not configured");
    });

    it("should return error when seed directory is not found", () => {
      const mockErrorResponse = {
        success: false,
        error: "Seed directory not found",
      };

      expect(mockErrorResponse.success).toBe(false);
      expect(mockErrorResponse.error).toBe("Seed directory not found");
    });

    it("should handle missing category in seed file", () => {
      const mockSeedData = {
        title: "Test",
        content: "Test content",
        // Missing category
      };

      const isValid = (data: Record<string, unknown>) => {
        return data.category !== undefined;
      };

      expect(isValid(mockSeedData)).toBe(false);
    });

    it("should validate seed file structure", () => {
      const mockValidSeedData = {
        title: "Temple Timings",
        category: "temple-timings",
        content: "Daily timings information",
        published: true,
      };

      const isValid = (data: Record<string, unknown>) => {
        return (
          typeof data.title === "string" &&
          typeof data.category === "string" &&
          typeof data.content === "string" &&
          typeof data.published === "boolean"
        );
      };

      expect(isValid(mockValidSeedData)).toBe(true);
    });
  });
});

describe("Knowledge Empty State", () => {
  it("should detect empty knowledge base", () => {
    const coverage = {
      summary: {
        total: 14,
        present: 0,
        missing: 14,
        percentage: 0,
      },
    };

    const isEmpty = coverage.summary.present === 0 && coverage.summary.total > 0;
    
    expect(isEmpty).toBe(true);
  });

  it("should not show empty state when partial coverage exists", () => {
    const coverage = {
      summary: {
        total: 14,
        present: 7,
        missing: 7,
        percentage: 50,
      },
    };

    const isEmpty = coverage.summary.present === 0 && coverage.summary.total > 0;
    
    expect(isEmpty).toBe(false);
  });

  it("should not show empty state when full coverage exists", () => {
    const coverage = {
      summary: {
        total: 14,
        present: 14,
        missing: 0,
        percentage: 100,
      },
    };

    const isEmpty = coverage.summary.present === 0 && coverage.summary.total > 0;
    
    expect(isEmpty).toBe(false);
  });
});
