import { normaliseHeroImage } from '@/lib/supabase/helpers';

describe('normaliseHeroImage', () => {
  test('Dashboard URL with path and preview', () => {
    const url = 'https://supabase.com/dashboard/project/kvrkraqjuyxbraccxntk/storage/files/buckets/RayaramathaYNK?path=General+Pictures&preview=9d28d1beb69c661e8f897d6297d7034e.jpg';
    expect(normaliseHeroImage(url)).toBe('General Pictures/9d28d1beb69c661e8f897d6297d7034e.jpg');
  });

  test('Public storage URL', () => {
    const url = 'https://kvrkraqjuyxbraccxntk.supabase.co/storage/v1/object/public/RayaramathaYNK/General%20Pictures/hero.jpg';
    expect(normaliseHeroImage(url)).toBe('General Pictures/hero.jpg');
  });

  test('Legacy dashboard URL without preview', () => {
    const url = 'https://supabase.com/dashboard/project/kvrkraqjuyxbraccxntk/storage/files/buckets/RayaramathaYNK?path=General%20Pictures/legacy.jpg';
    expect(normaliseHeroImage(url)).toBe('General Pictures/legacy.jpg');
  });

  test('Raw storage path', () => {
    const path = 'General Pictures/raw.jpg';
    expect(normaliseHeroImage(path)).toBe(path);
  });

  test('Empty value returns empty string', () => {
    expect(normaliseHeroImage('')).toBe('');
    expect(normaliseHeroImage(undefined as any)).toBe('');
  });

  test('Spaces encoded as +', () => {
    const url = 'https://supabase.com/dashboard/project/kvrkraqjuyxbraccxntk/storage/files/buckets/RayaramathaYNK?path=General+Pictures&preview=space+file.jpg';
    expect(normaliseHeroImage(url)).toBe('General Pictures/space file.jpg');
  });

  test('URL with extra query params', () => {
    const url = 'https://supabase.com/dashboard/project/kvrkraqjuyxbraccxntk/storage/files/buckets/RayaramathaYNK?path=Folder&preview=image.jpg&foo=bar';
    expect(normaliseHeroImage(url)).toBe('Folder/image.jpg');
  });
});
