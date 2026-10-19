import type { SevaListItem, SevaLists } from '@/types/seva';
import { GOTRAS } from './gotras';
import { NAKSHATRAS } from './nakshatras';
import type { DomainOption } from './options';
import { RASHIS } from './rashis';

/**
 * The counter's gotra, nakshatra and rashi pick lists (plan A4P-5): the lists temple admins keep, as the counter
 * bootstrap carries them (and this PC caches them for offline use), over the built-in lists of this folder.
 * Pure: no I/O, used in the browser.
 *
 * - No lists (a bootstrap cached before A4P-5, or the office could not read them), or an empty list: the built-in one.
 * - Gotras: the admins' list in display order, hidden ones left out; built-in English aliases are kept by id.
 * - Nakshatras and rashis: the built-in names and ids, which are fixed; only a corrected Kannada spelling is taken.
 */
export interface CounterPickLists {
  gotras: readonly DomainOption[];
  nakshatras: readonly DomainOption[];
  rashis: readonly DomainOption[];
}

export const BUILT_IN_PICK_LISTS: CounterPickLists = { gotras: GOTRAS, nakshatras: NAKSHATRAS, rashis: RASHIS };

function byOrder(a: SevaListItem, b: SevaListItem): number {
  return a.displayOrder - b.displayOrder || a.id - b.id;
}

function gotraOptions(items: readonly SevaListItem[] | undefined): readonly DomainOption[] {
  if (!items || items.length === 0) return GOTRAS;
  const builtIn = new Map(GOTRAS.map((g) => [g.id, g]));
  return [...items]
    .filter((item) => item.active)
    .sort(byOrder)
    .map((item) => ({
      id: item.id,
      en: item.nameEn,
      kn: item.nameKn ?? '',
      aliases: builtIn.get(item.id)?.aliases ?? [],
    }));
}

/** The built-in list with each Kannada spelling the admins corrected. */
function fixedOptions(builtIn: readonly DomainOption[], items: readonly SevaListItem[] | undefined): readonly DomainOption[] {
  if (!items || items.length === 0) return builtIn;
  const kannada = new Map(items.map((item) => [item.id, item.nameKn?.trim() ?? '']));
  return builtIn.map((option) => {
    const kn = kannada.get(option.id);
    return kn ? { ...option, kn } : option;
  });
}

export function counterPickLists(lists: SevaLists | null | undefined): CounterPickLists {
  if (!lists) return BUILT_IN_PICK_LISTS;
  return {
    gotras: gotraOptions(lists.gotras),
    nakshatras: fixedOptions(NAKSHATRAS, lists.nakshatras),
    rashis: fixedOptions(RASHIS, lists.rashis),
  };
}
