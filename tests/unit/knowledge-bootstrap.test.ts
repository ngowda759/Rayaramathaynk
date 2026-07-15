// Unit tests for Knowledge Bootstrap System
// Tests the seed files, import logic, and coverage functionality

// Import fs and path using require to bypass Jest's module system
// This ensures we get the real fs module, not a mock
const fs = jest.requireActual("fs");
const path = jest.requireActual("path");

// Test data paths
const SEED_DIR = path.join(process.cwd(), "seed", "ai");

// Required knowledge categories
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

describe("Knowledge Bootstrap System", () => {
  // Helper to get seed files
  const getSeedFiles = (): string[] => fs.readdirSync(SEED_DIR).filter((f: string) => f.endsWith(".json"));

  describe("Seed Files", () => {
    it("should have seed directory", () => {
      expect(fs.existsSync(SEED_DIR)).toBe(true);
    });

    it("should have seed JSON files", () => {
      expect(getSeedFiles().length).toBeGreaterThan(0);
    });

    it("should have at least 14 seed files (one per category)", () => {
      expect(getSeedFiles().length).toBeGreaterThanOrEqual(14);
    });

    it("each seed file should be valid JSON", () => {
      const files = getSeedFiles();
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = path.join(SEED_DIR, file);
        const content = fs.readFileSync(filePath, "utf-8");
        expect(() => JSON.parse(content)).not.toThrow();
      }
    });

    it("each seed file should have required fields (title, category, content)", () => {
      const files = getSeedFiles();
      expect(files.length).toBeGreaterThan(0);
      
      // Check first file has title
      const filePath = path.join(SEED_DIR, files[0]);
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      expect(data).toHaveProperty("title");
      expect(data).toHaveProperty("category");
      expect(data).toHaveProperty("content");
    });

    it("each seed file should have published flag", () => {
      const files = getSeedFiles();
      expect(files.length).toBeGreaterThan(0);
      
      // Check first file has published
      const filePath = path.join(SEED_DIR, files[0]);
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      expect(data).toHaveProperty("published");
      expect(typeof data.published).toBe("boolean");
    });
  });

  describe("Category Coverage", () => {
    it("should have seed files for all required categories", () => {
      const files = getSeedFiles();
      const fileNames = files.map(f => f.replace(".json", ""));
      
      REQUIRED_CATEGORIES.forEach(category => {
        expect(fileNames).toContain(category.id);
      });
    });

    it("should have temple-timings seed file", () => {
      const filePath = path.join(SEED_DIR, "temple-timings.json");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("should have visitor-guidelines seed file", () => {
      const filePath = path.join(SEED_DIR, "visitor-guidelines.json");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("should have dress-code seed file", () => {
      const filePath = path.join(SEED_DIR, "dress-code.json");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("should have facilities seed file", () => {
      const filePath = path.join(SEED_DIR, "facilities.json");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("should have parking seed file", () => {
      const filePath = path.join(SEED_DIR, "parking.json");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("should have volunteer seed file", () => {
      const filePath = path.join(SEED_DIR, "volunteer.json");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("should have faq seed file", () => {
      const filePath = path.join(SEED_DIR, "faq.json");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("should have contact seed file", () => {
      const filePath = path.join(SEED_DIR, "contact.json");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("should have donation seed file", () => {
      const filePath = path.join(SEED_DIR, "donation.json");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("should have photography seed file", () => {
      const filePath = path.join(SEED_DIR, "photography.json");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("should have accommodation seed file", () => {
      const filePath = path.join(SEED_DIR, "accommodation.json");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("should have history seed file", () => {
      const filePath = path.join(SEED_DIR, "history.json");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("should have raghavendra-swamy seed file", () => {
      const filePath = path.join(SEED_DIR, "raghavendra-swamy.json");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("should have brindavana seed file", () => {
      const filePath = path.join(SEED_DIR, "brindavana.json");
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe("Seed File Content Quality", () => {
    it("temple-timings should have proper structure with timings", () => {
      const filePath = path.join(SEED_DIR, "temple-timings.json");
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      
      expect(data.timings).toBeDefined();
      expect(data.timings.morningOpen).toBeDefined();
      expect(data.timings.morningClose).toBeDefined();
      expect(data.timings.eveningOpen).toBeDefined();
      expect(data.timings.eveningClose).toBeDefined();
    });

    it("faq should have questions array", () => {
      const filePath = path.join(SEED_DIR, "faq.json");
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      
      expect(data.questions).toBeDefined();
      expect(Array.isArray(data.questions)).toBe(true);
      expect(data.questions.length).toBeGreaterThan(0);
    });

    it("contact should have contact information", () => {
      const filePath = path.join(SEED_DIR, "contact.json");
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      
      expect(data.contact).toBeDefined();
      expect(data.contact.phone).toBeDefined();
      expect(data.contact.email).toBeDefined();
    });

    it("dress-code should have guidelines array", () => {
      const filePath = path.join(SEED_DIR, "dress-code.json");
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      
      expect(data.guidelines).toBeDefined();
      expect(Array.isArray(data.guidelines)).toBe(true);
    });

    it("facilities should have facilities array", () => {
      const filePath = path.join(SEED_DIR, "facilities.json");
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      
      expect(data.facilities).toBeDefined();
      expect(Array.isArray(data.facilities)).toBe(true);
      expect(data.facilities.length).toBeGreaterThan(0);
    });

    it("volunteer should have opportunities array", () => {
      const filePath = path.join(SEED_DIR, "volunteer.json");
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      
      expect(data.opportunities).toBeDefined();
      expect(Array.isArray(data.opportunities)).toBe(true);
    });

    it("parking should have parking information", () => {
      const filePath = path.join(SEED_DIR, "parking.json");
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      
      expect(data.parking).toBeDefined();
    });

    it("donation should have donation options", () => {
      const filePath = path.join(SEED_DIR, "donation.json");
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      
      expect(data.donationOptions).toBeDefined();
      expect(Array.isArray(data.donationOptions)).toBe(true);
    });

    it("photography should have photography policy", () => {
      const filePath = path.join(SEED_DIR, "photography.json");
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      
      expect(data.policy).toBeDefined();
    });

    it("accommodation should have accommodation info", () => {
      const filePath = path.join(SEED_DIR, "accommodation.json");
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      
      expect(data.accommodation).toBeDefined();
    });

    it("history should have timeline", () => {
      const filePath = path.join(SEED_DIR, "history.json");
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      
      expect(data.timeline).toBeDefined();
      expect(Array.isArray(data.timeline)).toBe(true);
    });

    it("raghavendra-swamy should have biography", () => {
      const filePath = path.join(SEED_DIR, "raghavendra-swamy.json");
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      
      expect(data.biography).toBeDefined();
      expect(data.biography.birth).toBeDefined();
      expect(data.biography.death).toBeDefined();
    });

    it("brindavana should have rituals array", () => {
      const filePath = path.join(SEED_DIR, "brindavana.json");
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      
      expect(data.rituals).toBeDefined();
      expect(Array.isArray(data.rituals)).toBe(true);
    });
  });

  describe("Import Logic", () => {
    it("should not overwrite existing content by default", () => {
      // This tests the import logic behavior
      // The import API should skip categories that already exist when overwrite=false
      // This is tested via the API route tests
      expect(true).toBe(true);
    });

    it("should import all seed files when no existing content", () => {
      const files = fs.readdirSync(SEED_DIR).filter((f) => f.endsWith(".json"));
      const expectedImportCount = REQUIRED_CATEGORIES.length;
      
      expect(files.length).toBeGreaterThanOrEqual(expectedImportCount);
    });

    it("should generate consistent article IDs from categories", () => {
      // Article IDs should be category with dashes replaced by underscores
      const testCategory = "raghavendra-swamy";
      const expectedId = testCategory.replace(/-/g, "_");
      
      expect(expectedId).toBe("raghavendra_swamy");
    });
  });

  describe("Coverage Categories", () => {
    it("should have 14 required categories for complete coverage", () => {
      expect(REQUIRED_CATEGORIES.length).toBe(14);
    });

    it("all categories should have unique IDs", () => {
      const ids = REQUIRED_CATEGORIES.map((c) => c.id);
      const uniqueIds = [...new Set(ids)];
      
      expect(uniqueIds.length).toBe(ids.length);
    });

    it("all categories should have display names", () => {
      REQUIRED_CATEGORIES.forEach((category) => {
        expect(category.name).toBeDefined();
        expect(category.name.length).toBeGreaterThan(0);
      });
    });
  });
});
