/**
 * Returning-devotee profiles cached on the counter PC for offline matching (Design Book 9.2, 15.2; C-32). The phone is
 * never stored: only a salted SHA-256 hash (the salt is random per PC, kept in `meta`) and its last 4 digits.
 */
import { runTransaction, type SevaDb } from './db';
import { randomBase64Url, sha256HexBrowser } from './device';

export interface CachedProfile {
  phoneHash: string;
  phoneLast4: string;
  name: string;
  gotra?: string;
  gotraId?: number;
  nakshatraId?: number;
  rashiId?: number;
  lastSeen: string;
}

const SALT_KEY = 'profiles:salt';
const PHONE_PATTERN = /^\+91[6-9][0-9]{9}$/;
const MAX_MATCHES = 10;

async function readSalt(db: SevaDb): Promise<string | null> {
  const value = await db.get('meta', SALT_KEY);
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** The PC's salt, made once; one transaction so two tabs cannot each make their own. */
async function ensureSalt(db: SevaDb): Promise<string> {
  const tx = db.transaction('meta', 'readwrite');
  return runTransaction(tx, async () => {
    const value = await tx.store.get(SALT_KEY);
    if (typeof value === 'string' && value.length > 0) return value;
    const salt = randomBase64Url(16);
    await tx.store.put(salt, SALT_KEY);
    return salt;
  });
}

function hashPhone(salt: string, phoneE164: string): Promise<string> {
  return sha256HexBrowser(`${salt}:${phoneE164}`);
}

function fold(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** The whole name, or any word in it, starts with the typed text. */
function nameMatches(name: string, needle: string): boolean {
  const folded = fold(name);
  return folded.startsWith(needle) || folded.split(' ').some((word) => word.startsWith(needle));
}

/** Caches (or refreshes) a devotee's details under the salted hash of the phone. */
export async function cacheProfile(
  db: SevaDb,
  p: Omit<CachedProfile, 'phoneHash' | 'phoneLast4'> & { phoneE164: string },
): Promise<void> {
  if (!PHONE_PATTERN.test(p.phoneE164)) throw new RangeError('invalid_phone');
  const name = p.name.trim();
  if (name === '') throw new RangeError('invalid_name');
  const salt = await ensureSalt(db);
  // Field by field, so nothing else the caller's object carries (such as the phone) is ever stored.
  const profile: CachedProfile = {
    phoneHash: await hashPhone(salt, p.phoneE164),
    phoneLast4: p.phoneE164.slice(-4),
    name,
    lastSeen: p.lastSeen,
  };
  if (p.gotra !== undefined) profile.gotra = p.gotra;
  if (p.gotraId !== undefined) profile.gotraId = p.gotraId;
  if (p.nakshatraId !== undefined) profile.nakshatraId = p.nakshatraId;
  if (p.rashiId !== undefined) profile.rashiId = p.rashiId;
  await db.put('profiles', profile);
}

/**
 * Cached profiles for a full phone (exact match, listed first) and for a name (the name or one of its words starts
 * with the typed text, case-insensitive, most recently seen first). At most 10.
 */
export async function findProfiles(db: SevaDb, q: { name?: string; phoneE164?: string }): Promise<CachedProfile[]> {
  const found: CachedProfile[] = [];
  if (q.phoneE164 !== undefined && PHONE_PATTERN.test(q.phoneE164)) {
    const salt = await readSalt(db);
    if (salt !== null) {
      const hit = await db.get('profiles', await hashPhone(salt, q.phoneE164));
      if (hit) found.push(hit);
    }
  }
  const needle = fold(q.name ?? '');
  if (needle !== '') {
    const byName = (await db.getAll('profiles')).filter(
      (p) => nameMatches(p.name, needle) && !found.some((f) => f.phoneHash === p.phoneHash),
    );
    byName.sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : a.lastSeen > b.lastSeen ? -1 : 0));
    found.push(...byName);
  }
  return found.slice(0, MAX_MATCHES);
}
