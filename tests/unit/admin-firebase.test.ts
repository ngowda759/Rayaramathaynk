import { initializeAdminApp, getInitError, adminApp } from "../../lib/admin-firebase";

// Mock the firebase-admin/app module specifically to capture what gets passed to cert()
jest.mock("firebase-admin/app", () => {
  const original = jest.requireActual("firebase-admin/app");
  return {
    ...original,
    getApps: jest.fn(() => []), // Always pretend we haven't initialized
    cert: jest.fn((serviceAccount) => serviceAccount), // Return the config to inspect
    initializeApp: jest.fn((config) => {
      return { config } as any;
    }),
  };
});

describe("Admin Firebase SDK Initialization", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    // Clear out cached imports and states
    process.env.FIREBASE_PROJECT_ID = "test-project";
    process.env.FIREBASE_CLIENT_EMAIL = "test@example.com";
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  const getExtractedKey = async () => {
    const { initializeAdminApp } = await import("../../lib/admin-firebase");
    const app = await initializeAdminApp();
    const config = (app as any).config;
    return config.credential.privateKey;
  };

  const getExtractedProjectId = async () => {
    const { initializeAdminApp } = await import("../../lib/admin-firebase");
    const app = await initializeAdminApp();
    const config = (app as any).config;
    return config.credential.projectId;
  };

  it("should maintain FIREBASE_PROJECT_ID correctly without fallback", async () => {
    process.env.FIREBASE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----";
    const projectId = await getExtractedProjectId();
    expect(projectId).toBe("test-project");
  });

  it("should preserve valid PEM structure perfectly", async () => {
    const validPEM = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQ\n-----END PRIVATE KEY-----";
    process.env.FIREBASE_PRIVATE_KEY = validPEM;

    const key = await getExtractedKey();
    expect(key).toBe(validPEM);
  });

  it("should normalize literally escaped newlines (\\n)", async () => {
    const escapedPEM = "-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQ\\n-----END PRIVATE KEY-----";
    const expectedPEM = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQ\n-----END PRIVATE KEY-----";
    process.env.FIREBASE_PRIVATE_KEY = escapedPEM;

    const key = await getExtractedKey();
    expect(key).toBe(expectedPEM);
  });

  it("should normalize Windows CRLF (\\r\\n)", async () => {
    const crlfPEM = "-----BEGIN PRIVATE KEY-----\r\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQ\r\n-----END PRIVATE KEY-----";
    const expectedPEM = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQ\n-----END PRIVATE KEY-----";
    process.env.FIREBASE_PRIVATE_KEY = crlfPEM;

    const key = await getExtractedKey();
    expect(key).toBe(expectedPEM);
  });

  it("should strip surrounding double quotes", async () => {
    const expectedPEM = "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----";
    process.env.FIREBASE_PRIVATE_KEY = `"${expectedPEM}"`;

    const key = await getExtractedKey();
    expect(key).toBe(expectedPEM);
  });

  it("should strip surrounding single quotes", async () => {
    const expectedPEM = "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----";
    process.env.FIREBASE_PRIVATE_KEY = `'${expectedPEM}'`;

    const key = await getExtractedKey();
    expect(key).toBe(expectedPEM);
  });

  it("should fix missing trailing newlines inside the key structurally", async () => {
    const messyPEM = "-----BEGIN PRIVATE KEY-----MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQ-----END PRIVATE KEY-----";
    const expectedPEM = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQ\n-----END PRIVATE KEY-----";
    process.env.FIREBASE_PRIVATE_KEY = messyPEM;

    const key = await getExtractedKey();
    expect(key).toBe(expectedPEM);
  });

  it("should trim surrounding whitespace", async () => {
    const messyPEM = "   \n\n\n  -----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----    \n  ";
    const expectedPEM = "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----";
    process.env.FIREBASE_PRIVATE_KEY = messyPEM;

    const key = await getExtractedKey();
    expect(key).toBe(expectedPEM);
  });
});
