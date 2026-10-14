import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { checkAdminAuth } from '../../lib/auth/admin';

jest.mock('../../lib/admin-firebase', () => ({
  getAdminApp: jest.fn().mockResolvedValue({}),
}));

const verifyIdTokenMock = jest.fn();

jest.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    verifyIdToken: verifyIdTokenMock
  })
}));

describe('Admin Authentication Check', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  const createMockRequest = (authHeader: string | null) => {
    return {
      headers: {
        get: (key: string) => key === 'authorization' ? authHeader : null
      }
    } as any;
  };

  it('rejects missing auth header', async () => {
    const req = createMockRequest(null);
    const result = await checkAdminAuth(req);
    expect(result).toBeNull();
  });

  it('rejects invalid bearer token format', async () => {
    const req = createMockRequest('Basic xyz');
    const result = await checkAdminAuth(req);
    expect(result).toBeNull();
  });

  it('rejects when token is empty', async () => {
    const req = createMockRequest('Bearer ');
    const result = await checkAdminAuth(req);
    expect(result).toBeNull();
  });

  it('rejects when token verification fails', async () => {
    verifyIdTokenMock.mockRejectedValueOnce(new Error('Invalid token'));
    const req = createMockRequest('Bearer invalid-token');
    const result = await checkAdminAuth(req);
    expect(result).toBeNull();
  });

  it('resolves valid tokens', async () => {
    verifyIdTokenMock.mockResolvedValueOnce({ uid: 'user-123' });
    const req = createMockRequest('Bearer valid-token');
    const result = await checkAdminAuth(req);
    expect(result).toEqual({ uid: 'user-123', role: 'user' });
  });

  describe('ADMIN_API_KEY bypass behavior', () => {
    let originalApiKey: string | undefined;

    beforeEach(() => {
      originalApiKey = process.env.ADMIN_API_KEY;
    });

    afterEach(() => {
      if (originalApiKey === undefined) {
        delete process.env.ADMIN_API_KEY;
      } else {
        process.env.ADMIN_API_KEY = originalApiKey;
      }
    });

    it('rejects tokens when ADMIN_API_KEY is not set', async () => {
      delete process.env.ADMIN_API_KEY;
      verifyIdTokenMock.mockRejectedValueOnce(new Error('Invalid token fallback'));
      const req = createMockRequest('Bearer some-random-string');
      const result = await checkAdminAuth(req);
      expect(result).toBeNull();
    });

    it('rejects incorrect tokens when ADMIN_API_KEY is set', async () => {
      process.env.ADMIN_API_KEY = 'secret-key';
      verifyIdTokenMock.mockRejectedValueOnce(new Error('Invalid token fallback'));
      const req = createMockRequest('Bearer wrong-key');
      const result = await checkAdminAuth(req);
      expect(result).toBeNull();
    });

    it('resolves standard server-side token when ADMIN_API_KEY is set', async () => {
      process.env.ADMIN_API_KEY = 'secret-key';
      const req = createMockRequest('Bearer secret-key');
      const result = await checkAdminAuth(req);
      expect(result).toEqual({ uid: 'api-admin', role: 'admin' });
    });
  });

});
