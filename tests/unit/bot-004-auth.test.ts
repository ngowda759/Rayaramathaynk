/**
 * B2 regression: the retired static ADMIN_API_KEY bypass and ID-based authorization.
 *
 * These tests exercise the canonical admin guard (`verifyAdminUserResult`), which is the
 * only authorization path left for the site-settings server actions. Supabase Auth is the
 * sole identity; `public.users.auth_user_id` is the sole authorization link.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { verifyAdminUserResult } from '../../lib/auth/admin-auth';

jest.mock('server-only', () => ({}), { virtual: true });

const mockUsersTable: Array<Record<string, unknown>> = [];
const mockGetUser = jest.fn();

jest.mock('../../lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (table: string) => {
      if (table !== 'users') throw new Error(`unexpected table ${table}`);
      let column = '';
      let value: unknown;
      const builder = {
        select: () => builder,
        eq: (nextColumn: string, nextValue: unknown) => {
          column = nextColumn;
          value = nextValue;
          return builder;
        },
        maybeSingle: async () => ({
          data: mockUsersTable.find((row) => row[column] === value) ?? null,
          error: null,
        }),
      };
      return builder;
    },
  }),
}));

function makeRequest(authHeader: string | null) {
  return {
    headers: {
      get: (name: string) => (name.toLowerCase() === 'authorization' ? authHeader : null),
    },
  } as any;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUsersTable.length = 0;
});

describe('retired static ADMIN_API_KEY bypass', () => {
  const originalApiKey = process.env.ADMIN_API_KEY;

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.ADMIN_API_KEY;
    else process.env.ADMIN_API_KEY = originalApiKey;
  });

  it('rejects a bearer token equal to ADMIN_API_KEY', async () => {
    process.env.ADMIN_API_KEY = 'legacy-static-key';
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT' } });

    const result = await verifyAdminUserResult(makeRequest('Bearer legacy-static-key'));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_token');
    expect(JSON.stringify(result)).not.toContain('api-admin');
  });

  it('does not synthesize an api-admin identity from the static key', async () => {
    process.env.ADMIN_API_KEY = 'legacy-static-key';
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT' } });

    const result = await verifyAdminUserResult(makeRequest('Bearer legacy-static-key'));

    // A rejected guard result carries no authenticated user at all.
    expect(result).not.toHaveProperty('user');
  });

  it('rejects the literal api-admin token when Supabase does not recognize it', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT' } });

    const result = await verifyAdminUserResult(makeRequest('Bearer api-admin'));

    expect(result.ok).toBe(false);
  });
});

describe('ID-based identity cannot authorize', () => {
  it('denies a Supabase uid that matches users.id but not auth_user_id', async () => {
    mockUsersTable.push({
      id: 'attacker-uid',
      auth_user_id: 'someone-else',
      role: 'admin',
      active: true,
    });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'attacker-uid', email: 'attacker@example.test' } },
      error: null,
    });

    const result = await verifyAdminUserResult(makeRequest('Bearer valid-token'));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('user_not_found');
  });

  it('denies a Supabase uid that matches firestore_id but not auth_user_id', async () => {
    mockUsersTable.push({
      id: 'row-uuid',
      firestore_id: 'attacker-uid',
      auth_user_id: 'someone-else',
      role: 'admin',
      active: true,
    });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'attacker-uid', email: 'attacker@example.test' } },
      error: null,
    });

    const result = await verifyAdminUserResult(makeRequest('Bearer valid-token'));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('user_not_found');
  });

  it('authorizes a Supabase uid linked through auth_user_id', async () => {
    mockUsersTable.push({
      id: 'row-uuid',
      auth_user_id: 'real-uid',
      role: 'super_admin',
      active: true,
      email: 'admin@example.test',
    });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'real-uid', email: 'admin@example.test' } },
      error: null,
    });

    const result = await verifyAdminUserResult(makeRequest('Bearer valid-token'));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.uid).toBe('real-uid');
      expect(result.user.role).toBe('super_admin');
    }
  });

  it('still denies an inactive linked admin', async () => {
    mockUsersTable.push({
      id: 'row-uuid',
      auth_user_id: 'real-uid',
      role: 'admin',
      active: false,
    });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'real-uid', email: 'admin@example.test' } },
      error: null,
    });

    const result = await verifyAdminUserResult(makeRequest('Bearer valid-token'));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('inactive_user');
  });
});
