import { parseFirebasePrivateKey } from "../../lib/utils/firebase-key-parser";

describe("parseFirebasePrivateKey", () => {
  const syntheticPemParts = [
    "-----BEGIN PRIVATE KEY-----",
    "MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDEd5b",
    "yI9q3+X2Zf3B+T5e1",
    "-----END PRIVATE KEY-----"
  ];

  const correctPem = syntheticPemParts.join("\n");

  it("should handle correctly formatted PEM with actual newlines", () => {
    const result = parseFirebasePrivateKey(correctPem);
    expect(result).toBe(correctPem);
  });

  it("should handle literal \\n sequences", () => {
    const literalNewlinePem = syntheticPemParts.join("\\n");
    const result = parseFirebasePrivateKey(literalNewlinePem);
    expect(result).toBe(correctPem);
  });

  it("should handle CRLF line endings", () => {
    const crlfPem = syntheticPemParts.join("\r\n");
    const result = parseFirebasePrivateKey(crlfPem);
    expect(result).toBe(correctPem);
  });

  it("should handle surrounding double quotes", () => {
    const quotedPem = `"${correctPem}"`;
    const result = parseFirebasePrivateKey(quotedPem);
    expect(result).toBe(correctPem);
  });

  it("should handle surrounding single quotes", () => {
    const quotedPem = `'${correctPem}'`;
    const result = parseFirebasePrivateKey(quotedPem);
    expect(result).toBe(correctPem);
  });

  it("should handle empty string, null, and undefined safely", () => {
    expect(parseFirebasePrivateKey("")).toBe("");
    expect(parseFirebasePrivateKey(null as unknown as string)).toBe("");
    expect(parseFirebasePrivateKey(undefined)).toBe("");
  });

  it("should handle a combination of literal \\n, CRLF and quotes", () => {
    const messyPem = `"-----BEGIN PRIVATE KEY-----\\n` +
      `MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDEd5b\\n` +
      `yI9q3+X2Zf3B+T5e1\\r\\n` +
      `-----END PRIVATE KEY-----"`;

    const result = parseFirebasePrivateKey(messyPem);
    expect(result).toBe(correctPem);
  });
});
