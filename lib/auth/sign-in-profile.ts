/**
 * The `users/{uid}` merge write the site's sign-in sends - shared by
 * `services/auth.service.ts` (`login`) and `lib/auth.ts` (`loginUser`).
 *
 * The access fields `role`, `isApproved` and `isActive` are sent only when the
 * profile does not exist yet: that is a create, and firestore.rules allows it
 * only as an active devotee who is not approved. For an existing profile they
 * are left out. The server staff API owns them (Admin SDK), and firestore.rules
 * refuses any client write that adds or changes one, so a staff profile the
 * staff API wrote without `isApproved` still signs in.
 */

/** The Firebase Auth account fields sign-in copies into the profile. */
export interface SignInAccount {
  uid: string;
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
}

export interface SignInProfileInput<TTimestamp> {
  account: SignInAccount;
  /** The address typed into the sign-in form; used only when neither the profile nor the account has one. */
  typedEmail: string;
  /** The current `users/{uid}` data, or `undefined` when the doc does not exist yet. */
  existingProfile: Readonly<Record<string, unknown>> | undefined;
  /** The timestamp to stamp: `serverTimestamp()` in the app. */
  now: TTimestamp;
}

/** The access fields a brand-new profile starts with (the only values the create rule allows). */
export const NEW_PROFILE_ACCESS_FIELDS = {
  role: "devotee",
  isApproved: false,
  isActive: true,
} as const;

export function buildSignInProfileWrite<TTimestamp>({
  account,
  typedEmail,
  existingProfile,
  now,
}: SignInProfileInput<TTimestamp>): Record<string, unknown> {
  const profileFields: Record<string, unknown> = {
    uid: account.uid,
    name:
      existingProfile?.name ??
      account.displayName ??
      account.email?.split("@")[0] ??
      "",
    email: existingProfile?.email ?? account.email ?? typedEmail,
    phone: existingProfile?.phone ?? "",
    templeId: existingProfile?.templeId ?? "main",
    profileImage: existingProfile?.profileImage ?? "",
    emailVerified: account.emailVerified,
    lastLogin: now,
    updatedAt: now,
  };

  if (existingProfile) {
    return profileFields;
  }

  return { ...profileFields, ...NEW_PROFILE_ACCESS_FIELDS, createdAt: now };
}
