/**
 * Unit tests for the Guru Aaradhane Dataset
 */

import {
  GURU_AARADHANES,
  GURU_AARADHANE_BY_ID,
  getAaradhanaesForGuru,
  getRaghavendraAaradhanes,
  getMajorAaradhanes,
  AARADHANE_COUNT,
} from "@/data/aaradhane/gurus";

describe("Guru Aaradhane Dataset", () => {
  describe("GURU_AARADHANES", () => {
    it("should contain 19 Guru Aaradhanes", () => {
      expect(GURU_AARADHANES.length).toBe(19);
    });

    it("should have all required fields for each guru", () => {
      for (const guru of GURU_AARADHANES) {
        expect(guru.id).toBeDefined();
        expect(guru.guruName).toBeDefined();
        expect(guru.title).toBeDefined();
        expect(guru.paramparaNumber).toBeDefined();
        expect(guru.lunarMonth).toBeDefined();
        expect(guru.paksha).toBeDefined();
        expect(guru.tithiNumber).toBeDefined();
        expect(guru.tithi).toBeDefined();
        expect(guru.durationDays).toBeDefined();
        expect(guru.importance).toBeDefined();
      }
    });

    it("should have valid lunar month values", () => {
      const validMonths = [
        "Chaitra", "Vaishakha", "Jyeṣṭha", "Āṣāḍha",
        "Śrāvaṇa", "Bhādrapada", "Āśvina", "Kārtika",
        "Mārghaśīrṣa", "Pauṣa", "Māgha", "Phālguna"
      ];
      
      for (const guru of GURU_AARADHANES) {
        expect(validMonths).toContain(guru.lunarMonth);
      }
    });

    it("should have valid paksha values", () => {
      const validPaksha = ["Shukla", "Krishna"];
      
      for (const guru of GURU_AARADHANES) {
        expect(validPaksha).toContain(guru.paksha);
      }
    });

    it("should have tithi numbers between 1 and 30", () => {
      for (const guru of GURU_AARADHANES) {
        expect(guru.tithiNumber).toBeGreaterThanOrEqual(1);
        expect(guru.tithiNumber).toBeLessThanOrEqual(30);
      }
    });

    it("should have duration days between 1 and 3", () => {
      for (const guru of GURU_AARADHANES) {
        expect(guru.durationDays).toBeGreaterThanOrEqual(1);
        expect(guru.durationDays).toBeLessThanOrEqual(3);
      }
    });

    it("should have unique IDs for all Gurus", () => {
      const ids = GURU_AARADHANES.map(g => g.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should have correct parampara numbers from 1 to 17", () => {
      const numbers = GURU_AARADHANES.map(g => g.paramparaNumber);
      const uniqueNumbers = [...new Set(numbers)];
      
      // Parampara should have values 1-17 (some Gurus have multiple phases)
      expect(uniqueNumbers.length).toBeLessThanOrEqual(17);
      for (const num of uniqueNumbers) {
        expect(num).toBeGreaterThanOrEqual(1);
        expect(num).toBeLessThanOrEqual(17);
      }
    });
  });

  describe("Sri Raghavendra Swamy", () => {
    it("should have exactly 3 Aaradhanes (Poorva, Madhya, Uttara)", () => {
      const raghavendraAaradhanes = getRaghavendraAaradhanes();
      expect(raghavendraAaradhanes.length).toBe(3);
    });

    it("should have Poorva, Madhya, and Uttara phases", () => {
      const raghavendraAaradhanes = getRaghavendraAaradhanes();
      const phases = raghavendraAaradhanes
        .map(a => a.raghavendraPhase)
        .filter(Boolean);
      
      expect(phases).toContain("Poorva");
      expect(phases).toContain("Madhya");
      expect(phases).toContain("Uttara");
    });

    it("should have Poorva Aaradhane in Vaishakha Krishna Trayodashi", () => {
      const poorva = GURU_AARADHANE_BY_ID.get("raghavendra-poorva");
      expect(poorva).toBeDefined();
      expect(poorva?.lunarMonth).toBe("Vaishakha");
      expect(poorva?.paksha).toBe("Krishna");
      expect(poorva?.tithiNumber).toBe(13);
      expect(poorva?.tithi).toBe("Trayodashi");
    });

    it("should have Madhya Aaradhane in Jyeṣṭha Shukla Ekadashi", () => {
      const madhya = GURU_AARADHANE_BY_ID.get("raghavendra-madhya");
      expect(madhya).toBeDefined();
      expect(madhya?.lunarMonth).toBe("Jyeṣṭha");
      expect(madhya?.paksha).toBe("Shukla");
      expect(madhya?.tithiNumber).toBe(11);
      expect(madhya?.tithi).toBe("Ekadashi");
    });

    it("should have Uttara Aaradhane in Māgha Krishna Ekadashi", () => {
      const uttara = GURU_AARADHANE_BY_ID.get("raghavendra-uttara");
      expect(uttara).toBeDefined();
      expect(uttara?.lunarMonth).toBe("Māgha");
      expect(uttara?.paksha).toBe("Krishna");
      expect(uttara?.tithiNumber).toBe(11);
      expect(uttara?.tithi).toBe("Ekadashi");
    });

    it("all Raghavendra Aaradhanes should have 3-day duration", () => {
      const raghavendraAaradhanes = getRaghavendraAaradhanes();
      for (const aaradhane of raghavendraAaradhanes) {
        expect(aaradhane.durationDays).toBe(3);
      }
    });
  });

  describe("Major Importance Gurus", () => {
    it("should include Sri Madhvacharya as major importance", () => {
      const madhvacharya = GURU_AARADHANE_BY_ID.get("madhvacharya");
      expect(madhvacharya?.importance).toBe("major");
    });

    it("should include Sri Jayateertha as major importance", () => {
      const jayateertha = GURU_AARADHANE_BY_ID.get("jayateertha");
      expect(jayateertha?.importance).toBe("major");
    });

    it("should include Sri Vidyadhiraja as major importance", () => {
      const vidyadhiraaja = GURU_AARADHANE_BY_ID.get("vidyadhiraaja");
      expect(vidyadhiraaja?.importance).toBe("major");
    });

    it("should have at least 8 major importance Gurus", () => {
      const majorAaradhanes = getMajorAaradhanes();
      expect(majorAaradhanes.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe("GURU_AARADHANE_BY_ID lookup", () => {
    it("should find all Gurus by ID", () => {
      for (const guru of GURU_AARADHANES) {
        const found = GURU_AARADHANE_BY_ID.get(guru.id);
        expect(found).toBeDefined();
        expect(found?.id).toBe(guru.id);
      }
    });

    it("should return undefined for non-existent ID", () => {
      const found = GURU_AARADHANE_BY_ID.get("non-existent-guru");
      expect(found).toBeUndefined();
    });
  });

  describe("Helper Functions", () => {
    it("getAaradhanaesForGuru should return correct count for each guru", () => {
      // Most Gurus have 1 Aaradhane
      const raghavendra = getAaradhanaesForGuru("Sri Raghavendra Swamy");
      expect(raghavendra.length).toBe(3);
      
      // Others have 1
      const madhvacharya = getAaradhanaesForGuru("Sri Madhvacharya");
      expect(madhvacharya.length).toBe(1);
    });

    it("getMajorAaradhanes should return only major importance", () => {
      const majorAaradhanes = getMajorAaradhanes();
      for (const aaradhane of majorAaradhanes) {
        expect(aaradhane.importance).toBe("major");
      }
    });
  });

  describe("AARADHANE_COUNT", () => {
    it("should equal the length of GURU_AARADHANES", () => {
      expect(AARADHANE_COUNT).toBe(GURU_AARADHANES.length);
    });

    it("should be 19", () => {
      expect(AARADHANE_COUNT).toBe(19);
    });
  });
});
