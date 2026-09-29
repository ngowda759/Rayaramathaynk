import * as crypto from 'crypto';
import * as adminAppMod from "firebase-admin/app";

// Mock dependencies
jest.mock("firebase-admin/app", () => ({
  cert: jest.fn((val) => val),
  getApps: jest.fn(() => []),
  initializeApp: jest.fn((config) => config),
  applicationDefault: jest.fn(),
}));

jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

// Mock the getApps to be empty so initializeApp is called

function generateSyntheticPem() {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });
  return privateKey;
}

describe("Firebase Admin Initialization", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    // Clear the memoized app
    // @ts-expect-error Mock implementation
    adminAppMod.getApps.mockReturnValue([]);

    // reset internal state of initializeAdminApp by using the dynamic trick
    // This is hard to do cleanly because the module has module-level state.
    // However, since we mock getApps() to return [], and we ensure initError is null
    // it will try to re-initialize each time as long as we haven't successfully initialized and cached.
    // Since we mock initializeApp to just return the config, the module caches the config as 'adminApp'.
    // In our tests, we will load a fresh module or reset the state if possible.
    // Instead of messing with module internals, we use jest.isolateModules to test cleanly.
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const runWithFreshModule = async (setupEnv: () => void) => {
    let result: unknown;
    let error: unknown;

    // We must isolate modules because lib/admin-firebase caches `adminApp`
    await jest.isolateModulesAsync(async () => {
      // Setup the environment
      setupEnv();

      // Load the module freshly
      const mod = await import("../../lib/admin-firebase");

      try {
        result = await mod.initializeAdminApp();
      } catch (e) {
        error = e;
      }
    });

    if (error) throw error;
    return result;
  };

  it("should initialize successfully with valid FIREBASE_SERVICE_ACCOUNT_JSON containing a structural PEM", async () => {
    const syntheticPem = generateSyntheticPem();
    const validServiceAccount = {
      type: "service_account",
      project_id: "test-project-json",
      private_key: syntheticPem,
      client_email: "test@test-project-json.iam.gserviceaccount.com"
    };

    const result = await runWithFreshModule(() => {
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(validServiceAccount);
      delete process.env.FIREBASE_PROJECT_ID;
    });

    expect((result as { credential: unknown }).credential).toEqual(validServiceAccount);
  });

  it("should initialize successfully and prefer JSON over PEM vars", async () => {
    const validServiceAccount = {
      type: "service_account",
      project_id: "test-project-json",
      private_key: "json-key",
      client_email: "json-email"
    };

    const result = await runWithFreshModule(() => {
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(validServiceAccount);
      // Set the legacy vars too, they should be ignored
      process.env.FIREBASE_CLIENT_EMAIL = "pem-email";
      process.env.FIREBASE_PRIVATE_KEY = "pem-key";
      process.env.FIREBASE_PROJECT_ID = "test-project-json";
    });

    expect((result as { credential: unknown }).credential).toEqual(validServiceAccount);
  });

  it("should fail if required fields are missing from FIREBASE_SERVICE_ACCOUNT_JSON", async () => {
    const invalidServiceAccount = {
      type: "service_account",
      project_id: "test-project-json",
      // missing private_key and client_email
    };

    await expect(runWithFreshModule(() => {
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(invalidServiceAccount);
    })).rejects.toThrow("Invalid FIREBASE_SERVICE_ACCOUNT_JSON");
  });

  it("should fail if JSON is malformed", async () => {
    await expect(runWithFreshModule(() => {
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = "{ invalid-json }";
    })).rejects.toThrow("Failed to parse or initialize with FIREBASE_SERVICE_ACCOUNT_JSON.");
  });

  it("should fail if FIREBASE_PROJECT_ID mismatches JSON project_id", async () => {
    const validServiceAccount = {
      type: "service_account",
      project_id: "test-project-json",
      private_key: "key",
      client_email: "email"
    };

    await expect(runWithFreshModule(() => {
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(validServiceAccount);
      process.env.FIREBASE_PROJECT_ID = "different-project-id";
    })).rejects.toThrow("Project ID mismatch between FIREBASE_PROJECT_ID and service account.");
  });
});
