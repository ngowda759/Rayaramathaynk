/**
 * Image file-signature (magic-byte) validation.
 *
 * A browser-supplied `File.type` is attacker-controlled: renaming a script to
 * `.png` and sending `Content-Type: image/png` passes a MIME-only check. This
 * module inspects the leading bytes instead and only accepts the four formats
 * the profile uploader allows. It is deliberately dependency-free so it is safe
 * in either bundle and adds no image-decoding attack surface.
 *
 * The check is a header sniff, not a full decode: it rejects a mislabelled or
 * truncated file, but it does not claim to reject a polyglot whose leading bytes
 * are a valid header. Full re-encoding would need a native decoder (e.g. sharp),
 * which this project does not depend on; callers should treat a passing file as
 * "declared and sniffed as one of these formats", and keep storing it in a
 * non-executable, content-disposition-safe location.
 */

export type ImageMimeType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

/** The allow-listed image types, in the order a mismatch message names them. */
export const ALLOWED_IMAGE_TYPES: readonly ImageMimeType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const ALLOWED = new Set<string>(ALLOWED_IMAGE_TYPES);

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, i) => bytes[i] === byte);
}

/**
 * The format a byte prefix actually is, or `null` when it is not one of the
 * allow-listed formats.
 */
export function sniffImageType(bytes: Uint8Array): ImageMimeType | null {
  // JPEG: SOI marker FF D8 FF.
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A.
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // GIF: "GIF87a" or "GIF89a".
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61])) return "image/gif";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return "image/gif";
  // WebP: "RIFF" ???? "WEBP" (bytes 4-7 are the little-endian chunk size).
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export interface ImageSignatureResult {
  ok: boolean;
  /** The sniffed format, when the signature matched. */
  detected?: ImageMimeType;
  /** A caller-safe reason when the check failed. */
  reason?: string;
}

/**
 * Verify that `bytes` is one of the allow-listed image formats and that its
 * declared MIME type (if any) agrees with the bytes.
 *
 * A declared type that does not match the sniffed type is rejected: a PNG that
 * claims to be a JPEG is a mislabelled file, and a file whose bytes are not an
 * allowed image is rejected regardless of what it claims to be.
 */
export function verifyImageSignature(bytes: Uint8Array, declaredType?: string): ImageSignatureResult {
  const detected = sniffImageType(bytes);
  if (!detected) {
    return { ok: false, reason: "File is not a valid JPEG, PNG, WebP or GIF image" };
  }
  if (declaredType && ALLOWED.has(declaredType) && declaredType !== detected) {
    return {
      ok: false,
      detected,
      reason: `File content (${detected}) does not match its declared type (${declaredType})`,
    };
  }
  return { ok: true, detected };
}
