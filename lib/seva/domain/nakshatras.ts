import type { DomainOption } from './options';

/**
 * The 27 nakshatras in traditional order from Ashwini (Abhijit excluded).
 * Ids and spellings verbatim from DB §9.2; aliases are the English spelling variants from R4 §2.1.
 * Kannada is to be proof-read by the temple office (O-03).
 */
export const NAKSHATRAS: readonly DomainOption[] = [
  { id: 1, en: 'Ashwini', kn: 'ಅಶ್ವಿನಿ', aliases: ['Aswini'] },
  { id: 2, en: 'Bharani', kn: 'ಭರಣಿ', aliases: [] },
  { id: 3, en: 'Krittika', kn: 'ಕೃತ್ತಿಕಾ', aliases: ['Kruthika', 'Krithika'] },
  { id: 4, en: 'Rohini', kn: 'ರೋಹಿಣಿ', aliases: [] },
  { id: 5, en: 'Mrigashira', kn: 'ಮೃಗಶಿರ', aliases: ['Mrigashirsha', 'Mrugashira'] },
  { id: 6, en: 'Ardra', kn: 'ಆರ್ದ್ರಾ', aliases: ['Arudra'] },
  { id: 7, en: 'Punarvasu', kn: 'ಪುನರ್ವಸು', aliases: [] },
  { id: 8, en: 'Pushya', kn: 'ಪುಷ್ಯ', aliases: ['Pushyami', 'Pooshyam'] },
  { id: 9, en: 'Ashlesha', kn: 'ಆಶ್ಲೇಷಾ', aliases: ['Aslesha'] },
  { id: 10, en: 'Magha', kn: 'ಮಘಾ', aliases: ['Makha'] },
  { id: 11, en: 'Purva Phalguni', kn: 'ಪೂರ್ವಫಲ್ಗುಣಿ', aliases: ['Pubba', 'Poorva Phalguni'] },
  { id: 12, en: 'Uttara Phalguni', kn: 'ಉತ್ತರಫಲ್ಗುಣಿ', aliases: ['Uttara'] },
  { id: 13, en: 'Hasta', kn: 'ಹಸ್ತ', aliases: ['Hastha'] },
  { id: 14, en: 'Chitra', kn: 'ಚಿತ್ರಾ', aliases: ['Chitta'] },
  { id: 15, en: 'Swati', kn: 'ಸ್ವಾತಿ', aliases: ['Svati'] },
  { id: 16, en: 'Vishakha', kn: 'ವಿಶಾಖ', aliases: [] },
  { id: 17, en: 'Anuradha', kn: 'ಅನುರಾಧ', aliases: [] },
  { id: 18, en: 'Jyeshtha', kn: 'ಜ್ಯೇಷ್ಠ', aliases: ['Jyestha', 'Kette'] },
  { id: 19, en: 'Mula', kn: 'ಮೂಲ', aliases: ['Moola'] },
  { id: 20, en: 'Purvashadha', kn: 'ಪೂರ್ವಾಷಾಢ', aliases: ['Purva Ashadha'] },
  { id: 21, en: 'Uttarashadha', kn: 'ಉತ್ತರಾಷಾಢ', aliases: ['Uttara Ashadha'] },
  { id: 22, en: 'Shravana', kn: 'ಶ್ರವಣ', aliases: ['Sravana'] },
  { id: 23, en: 'Dhanishtha', kn: 'ಧನಿಷ್ಠ', aliases: ['Dhanishta'] },
  { id: 24, en: 'Shatabhisha', kn: 'ಶತಭಿಷ', aliases: ['Satabhisha'] },
  // 25 and 26: Kannada spelling UNCERTAIN (Madhwa usage often ಪೂರ್ವಾಭಾದ್ರಪದ / ಉತ್ತರಾಭಾದ್ರಪದ; R4 §2.1, O-03).
  { id: 25, en: 'Purva Bhadrapada', kn: 'ಪೂರ್ವಾಭಾದ್ರ', aliases: ['Purvabhadra'] },
  { id: 26, en: 'Uttara Bhadrapada', kn: 'ಉತ್ತರಾಭಾದ್ರ', aliases: ['Uttarabhadra'] },
  { id: 27, en: 'Revati', kn: 'ರೇವತಿ', aliases: [] },
];
