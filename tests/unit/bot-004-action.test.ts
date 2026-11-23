jest.mock("server-only", () => { return {}; }, { virtual: true });
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { createSettingsAction, updateSettingsAction } from '../../app/actions/settings';

const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: { id: '00000000-0000-0000-0000-000000000000' }, error: null }),
};

jest.mock('../../lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => mockSupabaseClient)
}));

// The settings actions authorize through the shared admin guard only.
const mockVerifyAdminUserResult = jest.fn();

jest.mock('../../lib/auth/admin-auth', () => ({
  verifyAdminUserResult: (...args: any[]) => mockVerifyAdminUserResult(...args),
}));

jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue(new Headers())
}));

jest.mock('next/server', () => ({
  NextRequest: class {
    constructor(url: string, init?: any) {
      return { headers: init?.headers || new Headers() };
    }
  }
}));

const authorizedAdmin = {
  ok: true,
  provider: 'supabase',
  user: { uid: 'admin-uuid', email: 'admin@example.test', role: 'admin', provider: 'supabase' },
};

function denied(reason: string, status = 403) {
  return { ok: false, reason, status, message: 'denied' };
}

describe('Settings Server Actions Authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSettingsAction', () => {
    it('rejects missing credentials/unauthenticated user', async () => {
      mockVerifyAdminUserResult.mockResolvedValueOnce(denied('missing_token', 401));
      await expect(createSettingsAction({ templeName: 'test', contactEmail: '', contactPhone: '', address: '', footerText: '', welcomeMessage: '' }))
        .rejects.toThrow('Unauthorized');
      expect(mockSupabaseClient.insert).not.toHaveBeenCalled();
    });

    it('rejects authenticated non-admin user', async () => {
      mockVerifyAdminUserResult.mockResolvedValueOnce(denied('insufficient_role'));
      await expect(createSettingsAction({ templeName: 'test', contactEmail: '', contactPhone: '', address: '', footerText: '', welcomeMessage: '' }))
        .rejects.toThrow('Unauthorized');
      expect(mockSupabaseClient.insert).not.toHaveBeenCalled();
    });

    it('does not honor the retired api-admin identity', async () => {
      // A static key / synthetic "api-admin" identity has no Supabase Auth user, so the
      // canonical guard reports user_not_found and the action must stay closed.
      mockVerifyAdminUserResult.mockResolvedValueOnce(denied('user_not_found'));
      await expect(createSettingsAction({ templeName: 'Valid Temple', contactEmail: 'test@example.com' } as any))
        .rejects.toThrow('Unauthorized');
      expect(mockSupabaseClient.insert).not.toHaveBeenCalled();
    });

    it('rejects invalid payloads with Zod for an authorized admin', async () => {
      mockVerifyAdminUserResult.mockResolvedValueOnce(authorizedAdmin);
      // Missing templeName which is required
      await expect(createSettingsAction({ templeName: '', contactEmail: '', contactPhone: '', address: '', footerText: '', welcomeMessage: '' }))
        .rejects.toThrow(/templeName is required/);
      expect(mockSupabaseClient.insert).not.toHaveBeenCalled();
    });

    it('allows authorized admin user with valid payload', async () => {
      mockVerifyAdminUserResult.mockResolvedValueOnce(authorizedAdmin);
      const result = await createSettingsAction({ templeName: 'Valid Temple', contactEmail: 'test@example.com' } as any);
      expect(result).toBe('00000000-0000-0000-0000-000000000000');
    });

    it('rejects inactive admin user', async () => {
      mockVerifyAdminUserResult.mockResolvedValueOnce(denied('inactive_user'));
      await expect(createSettingsAction({ templeName: 'test', contactEmail: '', contactPhone: '', address: '', footerText: '', welcomeMessage: '' }))
        .rejects.toThrow('Unauthorized');
      expect(mockSupabaseClient.insert).not.toHaveBeenCalled();
    });
  });

  describe('updateSettingsAction', () => {
    it('rejects missing credentials/unauthenticated user', async () => {
      mockVerifyAdminUserResult.mockResolvedValueOnce(denied('missing_token', 401));
      await expect(updateSettingsAction('00000000-0000-0000-0000-000000000000', { templeName: 'test' }))
        .rejects.toThrow('Unauthorized');
      expect(mockSupabaseClient.update).not.toHaveBeenCalled();
    });

    it('rejects authenticated non-admin user', async () => {
      mockVerifyAdminUserResult.mockResolvedValueOnce(denied('insufficient_role'));
      await expect(updateSettingsAction('00000000-0000-0000-0000-000000000000', { templeName: 'test' }))
        .rejects.toThrow('Unauthorized');
      expect(mockSupabaseClient.update).not.toHaveBeenCalled();
    });

    it('allows authorized admin user', async () => {
      mockVerifyAdminUserResult.mockResolvedValueOnce(authorizedAdmin);
      await expect(updateSettingsAction('00000000-0000-0000-0000-000000000000', { templeName: 'Valid Temple Update' }))
        .resolves.not.toThrow();
    });
  });

  describe('updateSettingsAction validation', () => {
    it('rejects invalid ID format', async () => {
      mockVerifyAdminUserResult.mockResolvedValueOnce(authorizedAdmin);
      await expect(updateSettingsAction('invalid-id', { templeName: 'test' }))
        .rejects.toThrow('Invalid id');
      expect(mockSupabaseClient.update).not.toHaveBeenCalled();
    });

    it('rejects empty payloads', async () => {
      mockVerifyAdminUserResult.mockResolvedValueOnce(authorizedAdmin);
      await expect(updateSettingsAction('00000000-0000-0000-0000-000000000000', {}))
        .rejects.toThrow(/Update payload cannot be empty/);
      expect(mockSupabaseClient.update).not.toHaveBeenCalled();
    });

    it('rejects invalid email formats', async () => {
      mockVerifyAdminUserResult.mockResolvedValueOnce(authorizedAdmin);
      await expect(updateSettingsAction('00000000-0000-0000-0000-000000000000', { contactEmail: 'not-an-email' }))
        .rejects.toThrow(/Invalid email format/);
      expect(mockSupabaseClient.update).not.toHaveBeenCalled();
    });
  });
});
