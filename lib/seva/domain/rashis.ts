import type { DomainOption } from './options';

/** The 12 rashis, ids and spellings verbatim from DB §9.2; aliases from R4 §2.2. */
export const RASHIS: readonly DomainOption[] = [
  { id: 1, en: 'Mesha', kn: 'ಮೇಷ', aliases: [] },
  { id: 2, en: 'Vrishabha', kn: 'ವೃಷಭ', aliases: ['Vrushabha'] },
  { id: 3, en: 'Mithuna', kn: 'ಮಿಥುನ', aliases: [] },
  { id: 4, en: 'Karkataka', kn: 'ಕರ್ಕಾಟಕ', aliases: ['Kataka'] },
  { id: 5, en: 'Simha', kn: 'ಸಿಂಹ', aliases: [] },
  { id: 6, en: 'Kanya', kn: 'ಕನ್ಯಾ', aliases: [] },
  { id: 7, en: 'Tula', kn: 'ತುಲಾ', aliases: [] },
  { id: 8, en: 'Vrishchika', kn: 'ವೃಶ್ಚಿಕ', aliases: [] },
  { id: 9, en: 'Dhanu', kn: 'ಧನು', aliases: [] },
  { id: 10, en: 'Makara', kn: 'ಮಕರ', aliases: [] },
  { id: 11, en: 'Kumbha', kn: 'ಕುಂಭ', aliases: [] },
  { id: 12, en: 'Meena', kn: 'ಮೀನ', aliases: [] },
];
