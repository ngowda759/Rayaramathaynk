/**
 * Shared shape and search for the devotee pick lists (nakshatra, rashi, gotra).
 * Pure: no I/O, used by the counter (browser) and the routes (server). DB §9.2.
 */
export interface DomainOption {
  /** Stable id stored in the database (nakshatra 1..27, rashi 1..12, gotra 0..56). */
  id: number;
  en: string;
  kn: string;
  /** English spelling variants accepted by search. */
  aliases: string[];
}

function fold(text: string): string {
  return text.normalize('NFC').trim().toLowerCase();
}

/**
 * Case-insensitive prefix search on the English name, the Kannada name and the aliases.
 * Exact matches (on any of those) come first; otherwise the list order is kept.
 */
export function searchOptions(options: readonly DomainOption[], query: string): DomainOption[] {
  const q = fold(query);
  if (q.length === 0) return [];
  const exact: DomainOption[] = [];
  const prefix: DomainOption[] = [];
  for (const option of options) {
    const names = [option.en, option.kn, ...option.aliases].map(fold);
    if (names.some((n) => n === q)) exact.push(option);
    else if (names.some((n) => n.startsWith(q))) prefix.push(option);
  }
  return [...exact, ...prefix];
}

/** Finds an option by its id; undefined when the id is not in the list. */
export function findOption(options: readonly DomainOption[], id: number | null | undefined): DomainOption | undefined {
  if (id === null || id === undefined) return undefined;
  return options.find((o) => o.id === id);
}
