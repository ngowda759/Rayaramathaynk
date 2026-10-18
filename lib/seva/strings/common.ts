/**
 * Printed and shared words, English with Kannada under it (C-49: Kannada always on its own line).
 * Kannada is to be proof-read by the temple office (O-03).
 */
export type Bi = { en: string; kn: string };

export const COMMON: {
  receiptNo: Bi;
  sevaDate: Bi;
  name: Bi;
  gotra: Bi;
  nakshatra: Bi;
  rashi: Bi;
  total: Bi;
  cash: Bi;
  cancelled: Bi;
  duplicate: Bi;
  showAtPrasadam: Bi;
} = {
  receiptNo: { en: 'Receipt No.', kn: 'ರಸೀದಿ ಸಂಖ್ಯೆ' },
  sevaDate: { en: 'Seva date', kn: 'ಸೇವಾ ದಿನಾಂಕ' },
  name: { en: 'Name', kn: 'ಹೆಸರು' },
  gotra: { en: 'Gotra', kn: 'ಗೋತ್ರ' },
  nakshatra: { en: 'Nakshatra', kn: 'ನಕ್ಷತ್ರ' },
  rashi: { en: 'Rashi', kn: 'ರಾಶಿ' },
  total: { en: 'Total', kn: 'ಒಟ್ಟು' },
  cash: { en: 'Cash', kn: 'ನಗದು' },
  cancelled: { en: 'Cancelled', kn: 'ರದ್ದು' },
  duplicate: { en: 'Duplicate', kn: 'ನಕಲು' },
  showAtPrasadam: { en: 'Show this at the prasadam counter', kn: 'ಪ್ರಸಾದ ಕೌಂಟರ್‌ನಲ್ಲಿ ತೋರಿಸಿ' },
};
