import {
  EMAIL_TRIM_WHITESPACE_CODEPOINTS,
  EMAIL_WHITESPACE_SQL_U_STRING,
  EmailNormalizationError,
  normalizeEmailAddress,
  tryNormalizeEmailAddress,
} from "@/lib/auth/email-normalization";

const WHITESPACE_CASES = EMAIL_TRIM_WHITESPACE_CODEPOINTS.map(
  (cp) => [`U+${cp.toString(16).toUpperCase().padStart(4, "0")}`, String.fromCodePoint(cp)] as const,
);

describe("email normalization contract", () => {
  it("uses exactly the runtime's ECMAScript trim whitespace set", () => {
    const derived: number[] = [];
    for (let cp = 0; cp <= 0xffff; cp += 1) {
      const char = String.fromCodePoint(cp);
      if (`${char}x`.trim() === "x") derived.push(cp);
    }
    expect(derived).toEqual([...EMAIL_TRIM_WHITESPACE_CODEPOINTS]);
  });

  it.each(WHITESPACE_CASES)("trims %s at both edges", (_label, char) => {
    expect(normalizeEmailAddress(`${char}User@Example.COM${char}`)).toBe("user@example.com");
  });

  it.each(WHITESPACE_CASES)("rejects %s inside the address", (_label, char) => {
    expect(() => normalizeEmailAddress(`us${char}er@example.com`)).toThrow(EmailNormalizationError);
    expect(tryNormalizeEmailAddress(`us${char}er@example.com`)).toEqual({
      ok: false,
      reason: "internal-whitespace",
    });
  });

  it("folds ASCII A-Z only and preserves non-ASCII case", () => {
    expect(normalizeEmailAddress("Ä@Example.COM")).toBe("Ä@example.com");
    expect(normalizeEmailAddress("İ@Example.COM")).toBe("İ@example.com");
  });

  it("treats null, empty and whitespace-only input as empty", () => {
    expect(normalizeEmailAddress(null)).toBe("");
    expect(tryNormalizeEmailAddress(" \t\r\n\u00a0")).toEqual({ ok: false, reason: "empty" });
  });

  it("does not remove separators that ECMAScript trim() does not remove", () => {
    for (const char of ["\u0085", "\u180e", "\u200b"]) {
      expect(normalizeEmailAddress(`${char}User@Example.com`)).toBe(`${char}user@example.com`);
    }
  });

  it("generates the SQL U& set for every trim code point", () => {
    const expected = EMAIL_TRIM_WHITESPACE_CODEPOINTS.map(
      (cp) => `\\${cp.toString(16).toUpperCase().padStart(4, "0")}`,
    ).join("");
    expect(EMAIL_WHITESPACE_SQL_U_STRING).toBe(expected);
  });
});
