/**
 * QR tokens printed on seva receipts (Design Book 10.3): 16 random bytes from a secure generator,
 * base64url without padding (22 characters). Never derived from the receipt id or number.
 */

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function toBase64Url(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += BASE64URL[(n >> 18) & 63] + BASE64URL[(n >> 12) & 63] + BASE64URL[(n >> 6) & 63] + BASE64URL[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += BASE64URL[(n >> 18) & 63] + BASE64URL[(n >> 12) & 63];
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += BASE64URL[(n >> 18) & 63] + BASE64URL[(n >> 12) & 63] + BASE64URL[(n >> 6) & 63];
  }
  return out;
}

/** A new random receipt token: 16 bytes from crypto.getRandomValues, base64url, 22 characters. */
export function newQrToken(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

/** True when the string has the shape of a receipt token. */
export function isQrToken(s: string): boolean {
  return TOKEN_PATTERN.test(s);
}

/** The URL the QR encodes: https://<site>/r/<token> (C-50). */
export function receiptQrUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/r/${token}`;
}
