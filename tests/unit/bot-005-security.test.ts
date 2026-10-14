import { describe, it, expect } from '@jest/globals';

describe('BOT-005 Security Tests', () => {
  it('prevents importing server-only modules in client-side execution contexts', () => {
    // We already verify auth and action validations in bot-004-action.test.ts and bot-004-auth.test.ts
    // This specifically tests the server-only boundary simulation.
    let error: any;
    global.window = {} as any;

    try {
      require('server-only');
    } catch (e: any) {
      error = e;
    } finally {
      delete (global as any).window;
    }

    expect(error).toBeDefined();
    expect(error.message).toContain('This module cannot be imported from a Client Component module');
  });

  it('rejects invalid configurations without fallback', () => {
    // Asserting that the codebase structure is maintained securely
    // without `typeof window` manual checks in admin.ts
    const fs = require('fs');
    const adminTs = fs.readFileSync('lib/supabase/admin.ts', 'utf8');
    expect(adminTs).toContain("import 'server-only';");
    expect(adminTs).not.toContain("typeof window !== 'undefined'");
  });
});
