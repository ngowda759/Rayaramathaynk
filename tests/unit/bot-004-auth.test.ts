import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { checkAdminAuth } from '../../lib/auth/admin';

// Supabase Auth is the only identity provider.
const mockGetUser = jest.fn();
jest.mock('../../lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
  }),
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
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Invalid token' } });
    const req = createMockRequest('Bearer invalid-token');
    const result = await checkAdminAuth(req);
    expect(result).toBeNull();
  });

  it('resolves valid tokens', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-123', email: 'u@example.test' } }, error: null });
    const req = createMockRequest('Bearer valid-token');
    const result = await checkAdminAuth(req);
    expect(result).toEqual({ uid: 'user-123', role: 'user', email: 'u@example.test' });
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
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Invalid token fallback' } });
      const req = createMockRequest('Bearer some-random-string');
      const result = await checkAdminAuth(req);
      expect(result).toBeNull();
    });

    it('rejects incorrect tokens when ADMIN_API_KEY is set', async () => {
      process.env.ADMIN_API_KEY = 'secret-key';
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Invalid token fallback' } });
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
