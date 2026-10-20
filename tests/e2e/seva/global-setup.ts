import { E2E_PASSWORD, E2E_ROLES, e2eEmail, type E2ERole } from "./fixtures/auth";
import { E2E_STAFF } from "./fixtures/data";

/**
 * Creates the five e2e accounts in the Auth emulator and their `users/{uid}` docs in the Firestore emulator, and
 * returns the global teardown. Talks only to the local emulators of the `demo-seva` project and refuses any other host.
 */
const PROJECT_ID = "demo-seva";
const API_KEY = "demo-key";

function emulatorHost(envName: string, fallback: string): string {
  const host = process.env[envName] ?? fallback;
  if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)) {
    throw new Error(`${envName} must point at a local emulator, got "${host}"`);
  }
  return `http://${host}`;
}

async function call(url: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${url} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? (JSON.parse(text) as unknown) : null;
}

/** The Firestore role stored for each e2e account; the view-only flag is a staff setting, not a role. */
function firestoreRole(role: E2ERole): string {
  return role === "temple_admin_view_only" ? "temple_admin" : role;
}

/**
 * Stops the Firestore emulator through its own `POST /shutdown` once the tests are done. On Windows, `java` on PATH can
 * be a launcher that starts the real JVM as a child; `emulators:exec` then stops only the launcher and the JVM keeps
 * port 8080, so the next run cannot start. Shutting it down here leaves nothing behind.
 */
async function stopFirestoreEmulator(firestore: string): Promise<void> {
  try {
    await fetch(`${firestore}/shutdown`, { method: "POST" });
  } catch {
    // Already stopped.
  }
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  const auth = emulatorHost("FIREBASE_AUTH_EMULATOR_HOST", "127.0.0.1:9099");
  const firestore = emulatorHost("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080");
  try {
    await seed(auth, firestore);
  } catch (error) {
    await stopFirestoreEmulator(firestore);
    throw error;
  }
  return () => stopFirestoreEmulator(firestore);
}

async function seed(auth: string, firestore: string): Promise<void> {
  const owner = { Authorization: "Bearer owner", "Content-Type": "application/json" };

  // Start from empty emulators so a rerun never meets accounts from an earlier run.
  await call(`${auth}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: "DELETE" });
  await call(`${firestore}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: "DELETE" });

  for (const role of E2E_ROLES) {
    const email = e2eEmail(role);
    const staff = E2E_STAFF[role];
    const account = await call(`${auth}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: E2E_PASSWORD, displayName: staff.name, returnSecureToken: true }),
    });
    const uid = typeof account === "object" && account !== null && "localId" in account ? String(account.localId) : "";
    if (!uid) throw new Error(`Auth emulator returned no uid for ${email}`);

    await call(`${firestore}/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`, {
      method: "PATCH",
      headers: owner,
      body: JSON.stringify({
        fields: {
          uid: { stringValue: uid },
          email: { stringValue: email },
          name: { stringValue: staff.name },
          phone: { stringValue: "" },
          templeId: { stringValue: "main" },
          profileImage: { stringValue: "" },
          role: { stringValue: firestoreRole(role) },
          isActive: { booleanValue: true },
          isApproved: { booleanValue: true },
          emailVerified: { booleanValue: false },
        },
      }),
    });
  }
}
