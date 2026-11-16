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
  });
});
