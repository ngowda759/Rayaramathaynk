import { isQrToken, newQrToken, receiptQrUrl } from "@/lib/seva/qr";

describe("QR tokens", () => {
  it("makes unique 22-character base64url tokens", () => {
    expect(isQrToken(newQrToken())).toBe(true);
    expect(newQrToken()).toHaveLength(22);
    expect(new Set(Array.from({ length: 1000 }, newQrToken)).size).toBe(1000);
  });

  it("validates tokens", () => {
    expect(isQrToken("AbCdEfGhIjKlMnOpQrStUv")).toBe(true);
    expect(isQrToken("AbCdEfGhIjKlMnOpQrStU")).toBe(false);
    expect(isQrToken("AbCdEfGhIjKlMnOpQrStU+")).toBe(false);
  });

  it("builds the receipt URL", () => {
    expect(receiptQrUrl("https://site.example", "AbCdEfGhIjKlMnOpQrStUv")).toBe(
      "https://site.example/r/AbCdEfGhIjKlMnOpQrStUv",
    );
    expect(receiptQrUrl("https://site.example/", "AbCdEfGhIjKlMnOpQrStUv")).toBe(
      "https://site.example/r/AbCdEfGhIjKlMnOpQrStUv",
    );
  });
});
