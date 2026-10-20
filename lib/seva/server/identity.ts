/**
 * The identity adapter - the only seva code that knows which sign-in provider is behind it (C-66). Everything else
 * works with the provider-neutral `externalUid` (stored as `staff.firebase_uid` today) and the access profile.
 * Moving to another provider later means writing a new adapter, not touching the routes.
 *
 * Identity rules (A1 security gate L-4): the email that identifies a person comes from the verified token or from
 * `staff.email`; the profile's own email field is never read, because the person can edit it.
 */

import "server-only";
import { firebaseIdentityAdapter } from "./identity-firebase";

export interface IdentityAdapter {
  /**
   * The verified caller of this request, or null when there is no valid, unrevoked sign-in. Throws (SevaError
   * 'internal') when the provider cannot be reached, so an outage answers 500, never "sign in again" (DB §16.2).
   */
  verifyRequest(req: Request): Promise<{ externalUid: string; email: string | null } | null>;
  /** Role and active flag (Firestore `users/{uid}` today); null when the person has no profile. */
  getAccessProfile(externalUid: string): Promise<{ role: unknown; isActive: boolean } | null>;
  createLogin(input: { email: string; displayName: string }): Promise<{ externalUid: string }>;
  setAccessProfile(
    externalUid: string,
    patch: { role?: string; isActive?: boolean; email?: string; displayName?: string },
  ): Promise<void>;
  /** `false` also revokes the person's refresh tokens, so every open session ends. */
  setLoginEnabled(externalUid: string, enabled: boolean): Promise<void>;
  deleteLogin(externalUid: string): Promise<void>;
}

let testAdapter: IdentityAdapter | null = null;

export function getIdentityAdapter(): IdentityAdapter {
  return testAdapter ?? firebaseIdentityAdapter;
}

/** Swaps in a fake adapter for unit tests; `null` restores the real one. Refused outside the test environment. */
export function setIdentityAdapterForTests(adapter: IdentityAdapter | null): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("setIdentityAdapterForTests may only be used in tests.");
  }
  testAdapter = adapter;
}
