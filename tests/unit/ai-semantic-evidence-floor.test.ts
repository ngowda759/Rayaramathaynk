// P5.2 — a similarity-only match must not claim structured evidence.
//
// `detectBySemantic` returned `requiresStructuredData: true` on its fall-through
// path, so a bare statement with no domain keyword could still trigger
// repository retrieval for an unrelated intent. Domain keywords return early at
// 100% confidence; anything that reaches the similarity tail is a guess and must
// be reported as unstructured so the generator's confidence gate applies.

jest.mock("server-only", () => ({}), { virtual: true });

import { detectIntent } from "@/lib/ai/intent";

describe("semantic evidence floor (P5.2)", () => {
  it("reports similarity-only guesses below the floor as unstructured", () => {
    for (const statement of [
      "I visited last year and enjoyed it",
      "It was a lovely day",
      "We came by car",
      "Very peaceful place",
    ]) {
      const result = detectIntent(statement);

      expect(result.matchedKeywords).toHaveLength(0);
      expect(result.confidence).toBeLessThan(55);
      expect(result.requiresStructuredData).toBe(false);
    }
  });

  it("keeps structured evidence when a domain keyword matches", () => {
    const result = detectIntent("What are the temple timings?");

    expect(result.confidence).toBe(100);
    expect(result.requiresStructuredData).toBe(true);
    expect(result.matchedKeywords.length).toBeGreaterThan(0);
  });

  it("never claims structured evidence without keyword support", () => {
    for (const statement of [
      "I visited last year and enjoyed it",
      "The architecture is stunning",
      "We came by car",
    ]) {
      const result = detectIntent(statement);

      if (result.matchedKeywords.length === 0) {
        expect(result.requiresStructuredData).toBe(false);
      }
    }
  });
});
