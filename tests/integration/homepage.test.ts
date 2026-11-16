<<<<<<< HEAD
import { homepageService } from '@/services/homepage.server';
import { normaliseHeroImage, getPublicUrl } from '@/lib/supabase/helpers';

/**
 * Integration test for saveHomepage – ensures a Supabase Dashboard URL is stored
 * as the correct public URL.
 */

describe('HomepageService.saveHomepage integration', () => {
  // Mock Supabase admin client – we replace the real client with a minimal stub
  // that captures the upsert payload.
  const mockUpsert = jest.fn().mockResolvedValue({ error: null });
  jest.mock('@/lib/supabase/admin', () => ({
    createAdminClient: () => ({
      storage: { from: () => ({ getPublicUrl: (path: string) => ({ publicUrl: `https://example.supabase.co/storage/v1/object/public/RayaramathaYNK/${encodeURIComponent(path)}` }) }) },
      from: () => ({ upsert: mockUpsert }),
    }),
  }));

  const dashboardUrl =
    'https://supabase.com/dashboard/project/kvrkraqjuyxbraccxntk/storage/files/buckets/RayaramathaYNK?path=General+Pictures&preview=hero.jpg';

  const config = { heroImage: dashboardUrl } as any; // other fields omitted for brevity

  it('stores public URL', async () => {
    await homepageService.saveHomepage(config);
    const expectedPath = 'General Pictures/hero.jpg';
    const expectedPublic = `https://example.supabase.co/storage/v1/object/public/RayaramathaYNK/${encodeURIComponent(expectedPath)}`;
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ heroImage: expectedPublic }) }),
      { onConflict: 'document_key' },
    );
=======
// tests/integration/homepage.test.ts
// Mock server-only to bypass client component restriction
jest.mock('server-only', () => ({}), { virtual: true });

import { homepageService } from '@/services/homepage.server';
import { supabase } from '@/lib/supabase/admin';
import { normaliseHeroImage } from '@/lib/supabase/helpers';

jest.mock('@/lib/supabase/admin', () => {
  const mockUpsert = jest.fn().mockResolvedValue({ error: null });
  const mockFrom = jest.fn(() => ({ upsert: mockUpsert }));
  return {
    createAdminClient: () => ({ from: mockFrom }),
    supabase: { from: mockFrom },
  };
});

describe('HomepageService.saveHomepage integration', () => {
  it('should normalise hero image URL before persisting', async () => {
    const dashboardUrl =
      'https://supabase.com/dashboard/project/kvrkraqjuyxbraccxntk/storage/files/buckets/RayaramathaYNK?path=General+Pictures&preview=9d28d1beb69c661e8f897d6297d7034e.jpg';
    const expectedPublicUrl =
      'https://supabase.com/storage/v1/object/public/RayaramathaYNK/General Pictures/9d28d1beb69c661e8f897d6297d7034e.jpg';
    // Mock config with heroImage as dashboard URL
    const config = {
      ...homepageService.getDefaultConfig(),
      heroTitle: 'Test',
      heroSubtitle: '',
      heroImage: dashboardUrl,
    } as any;

    // Spy on normaliseHeroImage indirectly via saveHomepage (assuming it uses that helper)
    await homepageService.saveHomepage(config);
    // Verify upsert called with normalized URL
    const mockFrom = require('@/lib/supabase/admin').supabase.from;
    const upsertCall = mockFrom.mock.calls[0][0]; // table name
    const upsertData = mockFrom.mock.results[0].value.upsert.mock.calls[0][0];
    expect(upsertData.data.heroImage).toBe(expectedPublicUrl);
>>>>>>> a3308b06 (Helper ts fix)
  });
});
