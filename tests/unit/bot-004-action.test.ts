jest.mock("server-only", () => { return {}; }, { virtual: true });
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { createSettingsAction, updateSettingsAction } from '../../app/actions/settings';

jest.mock('../../lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => ({
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: '00000000-0000-0000-0000-000000000000' }, error: null }),
  }))
}));

const mockCheckAdminAuth = jest.fn();
const mockIsUserAdmin = jest.fn();

jest.mock('../../lib/auth/admin', () => ({
  checkAdminAuth: (...args: any[]) => mockCheckAdminAuth(...args),
  isUserAdmin: (...args: any[]) => mockIsUserAdmin(...args)
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

describe('Settings Server Actions Authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSettingsAction', () => {
    it('rejects missing credentials/unauthenticated user', async () => {
      mockCheckAdminAuth.mockResolvedValueOnce(null);
      await expect(createSettingsAction({ templeName: 'test', contactEmail: '', contactPhone: '', address: '', footerText: '', welcomeMessage: '' }))
        .rejects.toThrow('Unauthorized');
      expect(require('../../lib/supabase/admin').createAdminClient().insert).not.toHaveBeenCalled();
    });

    it('rejects authenticated non-admin user', async () => {
      mockCheckAdminAuth.mockResolvedValueOnce({ uid: 'user123', role: 'user' });
      mockIsUserAdmin.mockResolvedValueOnce(false);
      await expect(createSettingsAction({ templeName: 'test', contactEmail: '', contactPhone: '', address: '', footerText: '', welcomeMessage: '' }))
        .rejects.toThrow('Unauthorized');
      expect(require('../../lib/supabase/admin').createAdminClient().insert).not.toHaveBeenCalled();
    });

    it('rejects invalid payloads with Zod', async () => {
      mockCheckAdminAuth.mockResolvedValueOnce({ uid: 'api-admin', role: 'admin' });
      // Missing templeName which is required
      await expect(createSettingsAction({ templeName: '', contactEmail: '', contactPhone: '', address: '', footerText: '', welcomeMessage: '' }))
        .rejects.toThrow(/templeName is required/);
      expect(require('../../lib/supabase/admin').createAdminClient().insert).not.toHaveBeenCalled();
    });

    it('allows authorized admin user with valid payload', async () => {
      mockCheckAdminAuth.mockResolvedValueOnce({ uid: 'user123', role: 'user' });
      mockIsUserAdmin.mockResolvedValueOnce(true);
      const result = await createSettingsAction({ templeName: 'Valid Temple', contactEmail: 'test@example.com' } as any);
      expect(result).toBe('00000000-0000-0000-0000-000000000000');
    });

    it('allows api-admin bypass', async () => {
      mockCheckAdminAuth.mockResolvedValueOnce({ uid: 'api-admin', role: 'admin' });
      const result = await createSettingsAction({ templeName: 'Valid Temple', contactEmail: 'test@example.com' } as any);
      expect(result).toBe('00000000-0000-0000-0000-000000000000');
    });
  });


    it('rejects inactive admin user', async () => {
      mockCheckAdminAuth.mockResolvedValueOnce({ uid: 'user123', role: 'user' });
      mockIsUserAdmin.mockResolvedValueOnce(false); // simulates isActive === false or role !== admin
      await expect(createSettingsAction({ templeName: 'test', contactEmail: '', contactPhone: '', address: '', footerText: '', welcomeMessage: '' }))
        .rejects.toThrow('Unauthorized');
      expect(require('../../lib/supabase/admin').createAdminClient().insert).not.toHaveBeenCalled();
    });

  describe('updateSettingsAction', () => {
    it('rejects missing credentials/unauthenticated user', async () => {
      mockCheckAdminAuth.mockResolvedValueOnce(null);
      await expect(updateSettingsAction('00000000-0000-0000-0000-000000000000', { templeName: 'test' }))
        .rejects.toThrow('Unauthorized');
      expect(require('../../lib/supabase/admin').createAdminClient().update).not.toHaveBeenCalled();
    });

    it('rejects authenticated non-admin user', async () => {
      mockCheckAdminAuth.mockResolvedValueOnce({ uid: 'user123', role: 'user' });
      mockIsUserAdmin.mockResolvedValueOnce(false);
      await expect(updateSettingsAction('00000000-0000-0000-0000-000000000000', { templeName: 'test' }))
        .rejects.toThrow('Unauthorized');
      expect(require('../../lib/supabase/admin').createAdminClient().update).not.toHaveBeenCalled();
    });

    it('allows authorized admin user', async () => {
      mockCheckAdminAuth.mockResolvedValueOnce({ uid: 'user123', role: 'user' });
      mockIsUserAdmin.mockResolvedValueOnce(true);
      await expect(updateSettingsAction('00000000-0000-0000-0000-000000000000', { templeName: 'Valid Temple Update' }))
        .resolves.not.toThrow();
    });
  });
});

  describe('updateSettingsAction validation', () => {
    it('rejects empty payloads', async () => {
       mockCheckAdminAuth.mockResolvedValueOnce({ uid: 'api-admin', role: 'admin' });
       await expect(updateSettingsAction('00000000-0000-0000-0000-000000000000', {}))
         .rejects.toThrow(/Update payload cannot be empty/);
       expect(require('../../lib/supabase/admin').createAdminClient().update).not.toHaveBeenCalled();
    });

    it('rejects invalid email formats', async () => {
       mockCheckAdminAuth.mockResolvedValueOnce({ uid: 'api-admin', role: 'admin' });
       await expect(updateSettingsAction('00000000-0000-0000-0000-000000000000', { contactEmail: 'not-an-email' }))
         .rejects.toThrow(/Invalid email format/);
       expect(require('../../lib/supabase/admin').createAdminClient().update).not.toHaveBeenCalled();
    });
  });
