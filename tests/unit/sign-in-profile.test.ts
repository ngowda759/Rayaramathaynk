/**
 * The sign-in merge write to `users/{uid}` (security gate S-7 follow-up).
 * `role`, `isApproved` and `isActive` are sent only when sign-in creates the
 * profile. An existing profile never gets them from the browser, because
 * firestore.rules refuses any client write that adds or changes one - a staff
 * profile the staff API wrote without `isApproved` must still sign in.
 */
import { buildSignInProfileWrite } from "@/lib/auth/sign-in-profile";
import { authService } from "@/services/auth.service";
import { loginUser } from "@/lib/auth";

const mockSetDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockSignIn = jest.fn();
const mockServerTimestamp = { sentinel: "serverTimestamp" };

jest.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignIn(...args),
  sendPasswordResetEmail: jest.fn(),
  sendEmailVerification: jest.fn(),
  signOut: jest.fn(),
  updateProfile: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...segments: string[]) => ({ path: segments.join("/") }),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  serverTimestamp: () => mockServerTimestamp,
}));

jest.mock("@/lib/firebase", () => ({
  auth: {},
  db: {},
  isFirebaseConfigured: true,
  getFirebaseConfigStatus: () => ({ isValid: true, missingFields: [] }),
}));

const ACCESS_FIELDS = ["role", "isApproved", "isActive"] as const;

const STAFF_ACCOUNT = {
  uid: "rec-uid",
  displayName: "Counter One",
  email: "counter@example.test",
  emailVerified: true,
};

/** A users doc as the staff API's setAccessProfile writes it: no `isApproved`. */
const STAFF_PROFILE_FROM_STAFF_API = {
  role: "receptionist",
  isActive: true,
  email: "counter@example.test",
  displayName: "Counter One",
};

function signInAs(profile: Record<string, unknown> | undefined) {
  mockSignIn.mockResolvedValue({ user: STAFF_ACCOUNT });
  mockGetDoc.mockResolvedValue({
    exists: () => profile !== undefined,
    data: () => profile,
  });
}

function lastWrite(): { path: string; data: Record<string, unknown>; options: unknown } {
  expect(mockSetDoc).toHaveBeenCalledTimes(1);
  const [ref, data, options] = mockSetDoc.mock.calls[0] as [
    { path: string },
    Record<string, unknown>,
    unknown,
  ];
  return { path: ref.path, data, options };
}

beforeEach(() => {
  mockSetDoc.mockReset();
  mockGetDoc.mockReset();
  mockSignIn.mockReset();
});

describe("buildSignInProfileWrite", () => {
  it("leaves role, isApproved and isActive out for an existing profile", () => {
    const write = buildSignInProfileWrite({
      account: STAFF_ACCOUNT,
      typedEmail: "counter@example.test",
      existingProfile: STAFF_PROFILE_FROM_STAFF_API,
      now: mockServerTimestamp,
    });

    for (const field of ACCESS_FIELDS) expect(write).not.toHaveProperty(field);
    expect(write).not.toHaveProperty("createdAt");
    expect(write).toMatchObject({
      uid: "rec-uid",
      name: "Counter One",
      email: "counter@example.test",
      phone: "",
      templeId: "main",
      profileImage: "",
      emailVerified: true,
      lastLogin: mockServerTimestamp,
      updatedAt: mockServerTimestamp,
    });
  });

  it("creates a devotee who is active and not approved when no profile exists", () => {
    const write = buildSignInProfileWrite({
      account: { uid: "new-uid", displayName: null, email: "new.person@example.test", emailVerified: false },
      typedEmail: "typed@example.test",
      existingProfile: undefined,
      now: mockServerTimestamp,
    });

    expect(write).toEqual({
      uid: "new-uid",
      name: "new.person",
      email: "new.person@example.test",
      phone: "",
      role: "devotee",
      templeId: "main",
      profileImage: "",
      isApproved: false,
      isActive: true,
      emailVerified: false,
      lastLogin: mockServerTimestamp,
      updatedAt: mockServerTimestamp,
      createdAt: mockServerTimestamp,
    });
  });

  it("keeps the existing profile's own name, email, phone, temple and image", () => {
    const write = buildSignInProfileWrite({
      account: STAFF_ACCOUNT,
      typedEmail: "typed@example.test",
      existingProfile: {
        name: "Saved Name",
        email: "saved@example.test",
        phone: "9999999999",
        templeId: "branch",
        profileImage: "img.png",
        role: "temple_admin",
        isApproved: true,
        isActive: true,
      },
      now: mockServerTimestamp,
    });

    expect(write).toMatchObject({
      name: "Saved Name",
      email: "saved@example.test",
      phone: "9999999999",
      templeId: "branch",
      profileImage: "img.png",
    });
    for (const field of ACCESS_FIELDS) expect(write).not.toHaveProperty(field);
  });

  it("falls back to the typed email when neither the profile nor the account has one", () => {
    const write = buildSignInProfileWrite({
      account: { uid: "u", displayName: null, email: null, emailVerified: false },
      typedEmail: "typed@example.test",
      existingProfile: undefined,
      now: mockServerTimestamp,
    });

    expect(write.email).toBe("typed@example.test");
    expect(write.name).toBe("");
  });
});

describe.each([
  ["services/auth.service.ts login", (email: string, password: string) => authService.login(email, password)],
  ["lib/auth.ts loginUser", (email: string, password: string) => loginUser(email, password)],
])("%s", (_label, signIn) => {
  it("a first sign-in on a staff doc without isApproved sends no access field", async () => {
    signInAs(STAFF_PROFILE_FROM_STAFF_API);

    await signIn("counter@example.test", "secret");

    const { path, data, options } = lastWrite();
    expect(path).toBe("users/rec-uid");
    expect(options).toEqual({ merge: true });
    for (const field of ACCESS_FIELDS) expect(data).not.toHaveProperty(field);
    expect(data).not.toHaveProperty("createdAt");
    expect(data.lastLogin).toBe(mockServerTimestamp);
  });

  it("a sign-in with no profile yet creates a devotee profile", async () => {
    signInAs(undefined);

    await signIn("counter@example.test", "secret");

    const { data, options } = lastWrite();
    expect(options).toEqual({ merge: true });
    expect(data).toMatchObject({
      uid: "rec-uid",
      role: "devotee",
      isApproved: false,
      isActive: true,
      createdAt: mockServerTimestamp,
    });
  });
});
