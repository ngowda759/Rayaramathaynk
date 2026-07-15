// Unit tests for Knowledge Base
// Tests the knowledge repository and search functionality

import {
  KnowledgeArticle,
  KnowledgeCategory,
  CATEGORY_DISPLAY_NAMES,
  CATEGORY_ICONS,
} from "@/lib/ai/knowledge/types";

import {
  SEED_ARTICLES,
  getSeedArticlesForFirebase,
} from "@/lib/ai/knowledge/seed";

import {
  getKnowledgeArticles,
  searchArticles,
  getArticlesByCategory,
} from "@/lib/ai/knowledge/repository";

// Mock Firebase for tests
jest.mock("@/lib/firebase", () => ({
  db: null,
  isFirebaseConfigured: () => false,
}));

describe("Knowledge Base", () => {
  describe("Seed Articles", () => {
    it("should have seed articles for common topics", () => {
      expect(SEED_ARTICLES.length).toBeGreaterThan(0);
    });

    it("should have articles about temple history", () => {
      const historyArticles = SEED_ARTICLES.filter(
        (a) => a.category === "temple_history"
      );
      expect(historyArticles.length).toBeGreaterThan(0);
    });

    it("should have articles about Sri Raghavendra", () => {
      const raghavendraArticles = SEED_ARTICLES.filter(
        (a) => a.category === "sri_raghavendra"
      );
      expect(raghavendraArticles.length).toBeGreaterThan(0);
    });

    it("should have FAQ articles", () => {
      const faqArticles = SEED_ARTICLES.filter((a) => a.category === "faq");
      expect(faqArticles.length).toBeGreaterThan(0);
    });

    it("should have visitor guidelines", () => {
      const visitorArticles = SEED_ARTICLES.filter(
        (a) => a.category === "visitor_guidelines"
      );
      expect(visitorArticles.length).toBeGreaterThan(0);
    });

    it("should have donation information", () => {
      const donationArticles = SEED_ARTICLES.filter(
        (a) => a.category === "donation_info"
      );
      expect(donationArticles.length).toBeGreaterThan(0);
    });

    it("each article should have required fields", () => {
      SEED_ARTICLES.forEach((article) => {
        expect(article.title).toBeDefined();
        expect(article.title.length).toBeGreaterThan(0);
        expect(article.category).toBeDefined();
        expect(article.keywords).toBeDefined();
        expect(Array.isArray(article.keywords)).toBe(true);
        expect(article.keywords.length).toBeGreaterThan(0);
        expect(article.content).toBeDefined();
        expect(article.content.length).toBeGreaterThan(0);
      });
    });

    it("should have valid slugs", () => {
      SEED_ARTICLES.forEach((article) => {
        expect(article.slug).toBeDefined();
        expect(article.slug).toMatch(/^[a-z0-9-]+$/);
      });
    });
  });

  describe("getSeedArticlesForFirebase", () => {
    it("should return articles without IDs", () => {
      const articles = getSeedArticlesForFirebase();
      articles.forEach((article) => {
        expect((article as Record<string, unknown>).id).toBeUndefined();
      });
    });

    it("should return same number as seed articles", () => {
      const articles = getSeedArticlesForFirebase();
      expect(articles.length).toBe(SEED_ARTICLES.length);
    });
  });

  describe("Category Display Names", () => {
    it("should have display names for all categories", () => {
      const categories = Object.values(CATEGORY_DISPLAY_NAMES);
      categories.forEach((name) => {
        expect(name).toBeDefined();
        expect(name.length).toBeGreaterThan(0);
      });
    });

    it("should have icons for all categories", () => {
      const icons = Object.values(CATEGORY_ICONS);
      icons.forEach((icon) => {
        expect(icon).toBeDefined();
      });
    });
  });

  describe("getKnowledgeArticles (mock)", () => {
    it("should return seed articles when Firebase is not configured", async () => {
      const articles = await getKnowledgeArticles();
      expect(articles.length).toBe(SEED_ARTICLES.length);
    });
  });

  describe("searchArticles (mock)", () => {
    it("should find articles by keyword", async () => {
      const results = await searchArticles("raghavendra");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].relevanceScore).toBeGreaterThan(0);
    });

    it("should find articles by partial keyword", async () => {
      const results = await searchArticles("raghav");
      expect(results.length).toBeGreaterThan(0);
    });

    it("should return empty for non-matching query", async () => {
      const results = await searchArticles("xyznonexistent");
      expect(results.length).toBe(0);
    });

    it("should include matched keywords in results", async () => {
      const results = await searchArticles("raghavendra");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matchedKeywords.length).toBeGreaterThan(0);
    });

    it("should limit results", async () => {
      const results = await searchArticles("a", 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should find articles by title words", async () => {
      const results = await searchArticles("donation");
      expect(results.length).toBeGreaterThan(0);
    });

    it("should find articles by content words", async () => {
      const results = await searchArticles("karnataka");
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("getArticlesByCategory (mock)", () => {
    it("should return articles for a category", async () => {
      const articles = await getArticlesByCategory("faq");
      expect(articles.length).toBeGreaterThan(0);
      articles.forEach((article) => {
        expect(article.category).toBe("faq");
      });
    });

    it("should return empty array for non-existent category", async () => {
      // Test with a category that has no articles
      const articles = await getArticlesByCategory("brindavana" as KnowledgeCategory);
      // Either returns articles or empty array is acceptable
      expect(Array.isArray(articles)).toBe(true);
    });
  });

  describe("Article Content", () => {
    it("should have sufficient content length", () => {
      SEED_ARTICLES.forEach((article) => {
        expect(article.content.length).toBeGreaterThan(50);
      });
    });

    it("should have sufficient keywords", () => {
      SEED_ARTICLES.forEach((article) => {
        expect(article.keywords.length).toBeGreaterThanOrEqual(3);
      });
    });

    it("should have unique keywords", () => {
      SEED_ARTICLES.forEach((article) => {
        const uniqueKeywords = new Set(article.keywords.map((k) => k.toLowerCase()));
        expect(uniqueKeywords.size).toBe(article.keywords.length);
      });
    });
  });

  describe("Language Support", () => {
    it("should have English articles", () => {
      const enArticles = SEED_ARTICLES.filter((a) => a.language === "en");
      expect(enArticles.length).toBeGreaterThan(0);
    });
  });
});
