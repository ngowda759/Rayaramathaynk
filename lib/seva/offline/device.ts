/**
 * This PC's counter credentials (Design Book 8.4). On registration the PC makes a 32-byte random secret, keeps it in
 * IndexedDB and sends only its SHA-256 hash; every counter call then carries `x-seva-device: <device id>.<secret>`.
 * All randomness comes from crypto.getRandomValues.
 */
import type { SevaDb } from './db';

const DEVICE_KEY = 'device';
const DEVICE_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;
const SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface DeviceCredentials {
  deviceId: string;
  secret: string;
}

/** `n` random bytes as base64url without padding. */
export function randomBase64Url(n: number): string {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A new device secret: 32 random bytes, base64url (43 characters). */
export function newDeviceSecret(): string {
  return randomBase64Url(32);
}

/** SHA-256 of the UTF-8 text as lower-case hex, the same as the server's sha256Hex (node:crypto). */
export async function sha256HexBrowser(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function isCredentials(value: unknown): value is DeviceCredentials {
  return (
    typeof value === 'object' &&
    value !== null &&
    'deviceId' in value &&
    'secret' in value &&
    typeof value.deviceId === 'string' &&
    typeof value.secret === 'string' &&
    DEVICE_ID_PATTERN.test(value.deviceId) &&
    SECRET_PATTERN.test(value.secret)
  );
}

/** The saved credentials, or null when this PC is not registered. */
export async function getDeviceCredentials(db: SevaDb): Promise<DeviceCredentials | null> {
  const value = await db.get('meta', DEVICE_KEY);
  return isCredentials(value) ? { deviceId: value.deviceId, secret: value.secret } : null;
}

export async function saveDeviceCredentials(db: SevaDb, c: DeviceCredentials): Promise<void> {
  const credentials = { deviceId: c.deviceId, secret: c.secret };
  if (!isCredentials(credentials)) throw new RangeError('invalid_device_credentials');
  await db.put('meta', credentials, DEVICE_KEY);
}

/** The `x-seva-device` header value: '<deviceId>.<secret>'. */
export function deviceHeader(c: DeviceCredentials): string {
  return `${c.deviceId}.${c.secret}`;
}
