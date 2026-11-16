import { homepageService } from '@/services/homepage.server';
import type { HomepageConfig } from '@/types/homepage';

/**
 * Integration test for saveHomepage: a Supabase Dashboard URL must be normalised
 * and persisted as the canonical public Storage URL.
 *
 * The default Jest config only matches tests/unit, so run this file directly
 * with a testMatch override pointing at tests/integration.
 */

const mockUpsert = jest.fn().mockResolvedValue({ error: null });

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: () => ({ upsert: mockUpsert }) }),
}));

const PROJECT_URL = 'https://kvrkraqjuyxbraccxntk.supabase.co';

const DASHBOARD_URL =
  'https://supabase.com/dashboard/project/kvrkraqjuyxbraccxntk/storage/files/buckets/RayaramathaYNK?path=General+Pictures&preview=9d28d1beb69c661e8f897d6297d7034e.jpg';

const EXPECTED_PUBLIC_URL =
  'https://kvrkraqjuyxbraccxntk.supabase.co/storage/v1/object/public/RayaramathaYNK/General%20Pictures/9d28d1beb69c661e8f897d6297d7034e.jpg';

describe('HomepageService.saveHomepage integration', () => {
  beforeEach(() => {
    mockUpsert.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = PROJECT_URL;
  });

  it('stores the normalised public URL for a Dashboard URL', async () => {
    const config = { heroImage: DASHBOARD_URL } as unknown as HomepageConfig;

    await homepageService.saveHomepage(config);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        document_key: 'homepage',
        data: expect.objectContaining({ heroImage: EXPECTED_PUBLIC_URL }),
      }),
      { onConflict: 'document_key' },
    );
  });

  it('stores an empty string when the hero image is empty', async () => {
    const config = { heroImage: '' } as unknown as HomepageConfig;

    await homepageService.saveHomepage(config);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ heroImage: '' }),
      }),
      { onConflict: 'document_key' },
    );
  });
});
