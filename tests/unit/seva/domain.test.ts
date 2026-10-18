import { NAKSHATRAS } from '@/lib/seva/domain/nakshatras';
import { RASHIS } from '@/lib/seva/domain/rashis';
import { GOTRAS } from '@/lib/seva/domain/gotras';
import { searchOptions } from '@/lib/seva/domain/options';
import { COMMON } from '@/lib/seva/strings/common';

describe('seva domain lists', () => {
  it('has the 27 nakshatras in order with the spec spellings', () => {
    expect(NAKSHATRAS).toHaveLength(27);
    expect(NAKSHATRAS[3]).toMatchObject({ id: 4, en: 'Rohini', kn: 'ರೋಹಿಣಿ' });
    expect(NAKSHATRAS.map((n) => n.id)).toEqual(Array.from({ length: 27 }, (_, i) => i + 1));
    expect(NAKSHATRAS[26]).toMatchObject({ id: 27, en: 'Revati', kn: 'ರೇವತಿ' });
  });

  it('has the 12 rashis in order', () => {
    expect(RASHIS).toHaveLength(12);
    expect(RASHIS[11]).toMatchObject({ id: 12, en: 'Meena', kn: 'ಮೀನ' });
    expect(RASHIS[0]).toMatchObject({ id: 1, en: 'Mesha', kn: 'ಮೇಷ' });
  });

  it('starts the gotras with Not known and then the 56 suggestions', () => {
    expect(GOTRAS[0]).toMatchObject({ id: 0, en: 'Not known', kn: 'ಗೊತ್ತಿಲ್ಲ' });
    expect(GOTRAS).toHaveLength(57);
    expect(GOTRAS[2]).toMatchObject({ id: 2, en: 'Bharadwaja' });
    expect(new Set(GOTRAS.map((g) => g.id)).size).toBe(57);
  });
});

describe('searchOptions', () => {
  it('matches an English prefix, case-insensitively', () => {
    expect(searchOptions(NAKSHATRAS, 'roh')[0].en).toBe('Rohini');
    expect(searchOptions(NAKSHATRAS, 'ROH')[0].en).toBe('Rohini');
  });

  it('matches a spelling variant through its alias', () => {
    expect(searchOptions(NAKSHATRAS, 'krithika')[0].en).toBe('Krittika');
    expect(searchOptions(GOTRAS, 'bharadvaj')[0].en).toBe('Bharadwaja');
  });

  it('matches a Kannada prefix', () => {
    expect(searchOptions(RASHIS, 'ಮೇ')[0].en).toBe('Mesha');
  });

  it('puts an exact match first', () => {
    const hits = searchOptions(GOTRAS, 'atri');
    expect(hits[0].en).toBe('Atri');
    const vatsa = searchOptions(GOTRAS, 'vatsa');
    expect(vatsa[0].en).toBe('Vatsa');
  });

  it('returns nothing for an empty or unmatched query', () => {
    expect(searchOptions(RASHIS, '   ')).toEqual([]);
    expect(searchOptions(RASHIS, 'zzz')).toEqual([]);
  });
});

describe('COMMON strings', () => {
  it('carries English with Kannada under for each printed word', () => {
    expect(COMMON.showAtPrasadam).toEqual({ en: 'Show this at the prasadam counter', kn: 'ಪ್ರಸಾದ ಕೌಂಟರ್‌ನಲ್ಲಿ ತೋರಿಸಿ' });
    for (const value of Object.values(COMMON)) {
      expect(value.en.length).toBeGreaterThan(0);
      expect(value.kn.length).toBeGreaterThan(0);
    }
  });
});
