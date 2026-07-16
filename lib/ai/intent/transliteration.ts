/**
 * Kannada Transliteration Module
 * Converts Romanized Kannada (Velthuis/HK notation) to Unicode Kannada
 * 
 * Supports common transliteration patterns used by Indian users
 */

// Kannada vowel diacritics (matras)
const KANNADA_VOWELS: Record<string, string> = {
  a: "\u0C85", // ಅ
  A: "\u0C86", // ಆ (aa)
  aa: "\u0C86", // ಆ
  i: "\u0C87", // ಇ
  I: "\u0C88", // ಈ (ee)
  ii: "\u0C88", // ಈ
  u: "\u0C89", // ಉ
  U: "\u0C8A", // ಊ (oo)
  uu: "\u0C8A", // ಊ
  R: "\u0C8B", // ಋ
  e: "\u0C8E", // ಎ (e)
  E: "\u0C8F", // ಏ
  ai: "\u0C90", // ಐ
  o: "\u0C92", // ಒ
  O: "\u0C93", // ಓ
  au: "\u0C94", // ಔ
};

// Kannada consonants
const KANNADA_CONSONANTS: Record<string, string> = {
  k: "\u0C95", // ಕ
  kh: "\u0C96", // ಖ
  g: "\u0C97", // ಗ
  gh: "\u0C98", // ಘ
  ng: "\u0C99", // ಙ
  c: "\u0C9A", // ಚ
  ch: "\u0C9B", // ಛ
  j: "\u0C9C", // ಜ
  jh: "\u0C9D", // ಝ
  ny: "\u0C9E", // ಞ
  tt: "\u0C9F", // ಟ
  tth: "\u0CA0", // ಠ
  dd: "\u0CA1", // ಡ
  ddh: "\u0CA2", // ಢ
  nn: "\u0CA3", // ಣ
  t: "\u0C9F", // ತ (ta with dot)
  th: "\u0CA4", // ಥ
  d: "\u0CA6", // ದ
  dh: "\u0CA7", // ಧ
  n: "\u0CA8", // ನ
  nnn: "\u0CA3", // ಣ (retroflex)
  p: "\u0CAA", // ಪ
  ph: "\u0CAB", // ಫ
  b: "\u0CAC", // ಬ
  bh: "\u0CAD", // ಭ
  m: "\u0CAE", // ಮ
  y: "\u0CAF", // ಯ
  r: "\u0CB0", // ರ
  rr: "\u0CB1", // ಱ
  l: "\u0CB2", // ಲ
  ll: "\u0CB3", // ಳ
  v: "\u0CB5", // ವ
  sh: "\u0CB6", // ಶ
  ss: "\u0CB7", // ಷ
  s: "\u0CB8", // ಸ
  h: "\u0CB9", // ಹ
  f: "\u0CB9", // ಹ (for english words)
  z: "\u0C9C", // ಜ (for english words)
};

// Common standalone Kannada words (no transliteration needed)
const COMMON_KANNADA_WORDS: Record<string, string> = {
  // Temple related
  "namaskara": "\u0CA8\u0CAE\u0CB8\u0CCD\u0C95\u0CBE\u0CB0", // ನಮಸ್ಕಾರ
  "namaste": "\u0C8E\u0CB8\u0CC1\u0C9C\u0CCD\u0CAF", // ಎಸುಜ್ಞೆ
  "darshan": "\u0CA6\u0CB0\u0CCD\u0CB7\u0CA3", // ದರ್ಶನ
  "darshanam": "\u0CA6\u0CB0\u0CCD\u0CB7\u0CA3\u0CAE\u0CCD", // ದರ್ಶನಂ
  "seva": "\u0CB8\u0CC7\u0CB5\u0CC6", // ಸೇವೆ
  "sevas": "\u0CB8\u0CC7\u0CB5\u0CC6\u0C97\u0CB3\u0CCD", // ಸೇವೆಗಳ್
  "pooja": "\u0CAA\u0CC2\u0C9C", // ಪೂಜ
  "archana": "\u0C86\u0CB0\u0CCD\u0C9A\u0CA3", // ಆರ್ಚನ
  "aaradhane": "\u0C86\u0CB0\u0CBE\u0CA7\u0CA8\u0CC6", // ಆರಾಧನೆ
  "matha": "\u0CAE\u0CBE\u0C9F", // ಮಾಠ
  "mantap": "\u0CAE\u0C82\u0CA4\u0CAA\u0CCD", // ಮಂತಪ್ಪ
  "pradakshina": "\u0CAA\u0CB0\u0CBE\u0CA6\u0C95\u0CD7\u0CBF\u0CA3", // ಪರಾದಕ್ಷಿಣ
  "prasada": "\u0CAA\u0CB0\u0CB8\u0CBE\u0CA6", // ಪರಸಾದ
  "prasadam": "\u0CAA\u0CB0\u0CB8\u0CBE\u0CA6\u0CAE\u0CCD", // ಪರಸಾದಂ
  "tirtha": "\u0CA4\u0CBF\u0CB0\u0CDD\u0CA4", // ತೀರ್ಥ
  
  // Common words
  "swami": "\u0CB8\u0CCD\u0CB5\u0CBE\u0CAE\u0CBF", // ಸ್ವಾಮಿ
  "guru": "\u0C97\u0CC1\u0CB0\u0CC1", // ಗುರು
  "raghavendra": "\u0CB0\u0CBEಘವೇಂದ್ರ", // ರಾಘವೇಂದ್ರ
  "devotee": "\u0CB6\u0CB0ಣ",
  "bhakta": "\u0CB9\u0C95\u0CDD\u0CA4", // ಭಕ್ತ
  "bhakti": "\u0CB9\u0C95\u0CDD\u0CA4\u0CBF", // ಭಕ್ತಿ
  
  // Time related
  "samaya": "\u0CB8\u0CAEಯ", // ಸಮಯ (time)
  "kaala": "\u0C95ಾಲ", // ಕಾಲ (time)
  "belagu": "\u0CAC\u0CC6ಲಗು", // ಬೆಳಗು (morning)
  "sanjje": "\u0CB8\u0C82\u0C9C\u0CCD\u0C9C\u0CC6", // ಸಂಜೆ (evening)
  
  // Greetings
  "shubha": "\u0CB6\u0CC1\u0CB9", // ಶುಭ
  "shubham": "\u0CB6\u0CC1\u0CB9\u0CAE\u0CCD", // ಶುಭಂ
  "jaya": "\u0C9Cಯ", // ಜಯ
  "victory": "\u0C9Cಯ", // ಜಯ
  
  // Location
  "sthana": "\u0CB8\u0CCD\u0CA5ನ", // ಸ್ಥಾನ
  "sthalam": "\u0CB8\u0CCD\u0CA5ಲಂ", // ಸ್ಥಾಲಂ
};

/**
 * Check if a word is likely Romanized Kannada
 * (contains only transliteratable characters)
 */
function isRomanizedKannada(text: string): boolean {
  // Check if text contains common transliteration characters
  const romanizedPattern = /^[a-zA-Z]+$/;
  if (!romanizedPattern.test(text)) {
    return false;
  }
  
  // Check if it could be transliterated Kannada
  // (contains vowels like aa, ii, ee, oo, etc.)
  const hasKannadaVowels = /aa|ii|ee|oo|ai|au/i.test(text);
  const hasKannadaConsonants = /sh|ch|th|ng|ny|tt|dd|nn/i.test(text);
  
  return hasKannadaVowels || hasKannadaConsonants;
}

/**
 * Convert Romanized Kannada to Unicode Kannada
 * Uses a simplified transliteration approach
 */
export function transliterateToKannada(text: string): string {
  // First, check for common words
  const lowerText = text.toLowerCase().trim();
  const words = lowerText.split(/\s+/);
  const result: string[] = [];
  
  for (const word of words) {
    // Check if it's a common word
    if (COMMON_KANNADA_WORDS[word]) {
      result.push(COMMON_KANNADA_WORDS[word]);
      continue;
    }
    
    // Check if it looks like transliterated Kannada
    if (!isRomanizedKannada(word)) {
      result.push(word);
      continue;
    }
    
    // Transliterate the word
    result.push(transliterateWord(word));
  }
  
  return result.join(' ');
}

/**
 * Transliterate a single word
 */
function transliterateWord(word: string): string {
  let result = '';
  let i = 0;
  
  while (i < word.length) {
    // Check for two-letter combinations (aa, ii, ee, oo, ng, sh, ch, th, etc.)
    if (i + 1 < word.length) {
      const two = word.substring(i, i + 2).toLowerCase();
      
      // Vowel combinations
      if (two === 'aa' || two === 'aa') {
        result += '\u0C86'; // ಆ
        i += 2;
        continue;
      }
      if (two === 'ii' || two === 'ee') {
        result += '\u0C88'; // ಈ
        i += 2;
        continue;
      }
      if (two === 'uu' || two === 'oo') {
        result += '\u0C8A'; // ಊ
        i += 2;
        continue;
      }
      if (two === 'ai') {
        result += '\u0C90'; // ಐ
        i += 2;
        continue;
      }
      if (two === 'au') {
        result += '\u0C94'; // ಔ
        i += 2;
        continue;
      }
      
      // Consonant combinations
      if (two === 'ng') {
        result += '\u0C99'; // ಙ
        i += 2;
        continue;
      }
      if (two === 'sh') {
        result += '\u0CB6'; // ಶ
        i += 2;
        continue;
      }
      if (two === 'ch') {
        result += '\u0C9B'; // ಛ
        i += 2;
        continue;
      }
      if (two === 'th') {
        result += '\u0CA4'; // ಥ
        i += 2;
        continue;
      }
      if (two === 'dh') {
        result += '\u0CA7'; // ಧ
        i += 2;
        continue;
      }
      if (two === 'ny') {
        result += '\u0C9E'; // ಞ
        i += 2;
        continue;
      }
      if (two === 'tt') {
        result += '\u0C9F'; // ಟ
        i += 2;
        continue;
      }
      if (two === 'dd') {
        result += '\u0CA1'; // ಡ
        i += 2;
        continue;
      }
      if (two === 'nn') {
        result += '\u0CA3'; // ಣ
        i += 2;
        continue;
      }
      if (two === 'ss') {
        result += '\u0CB7'; // ಷ
        i += 2;
        continue;
      }
      if (two === 'rr') {
        result += '\u0CB1'; // ಱ
        i += 2;
        continue;
      }
      if (two === 'll') {
        result += '\u0CB3'; // ಳ
        i += 2;
        continue;
      }
      if (two === 'kh') {
        result += '\u0C96'; // ಖ
        i += 2;
        continue;
      }
      if (two === 'gh') {
        result += '\u0C98'; // ಘ
        i += 2;
        continue;
      }
      if (two === 'jh') {
        result += '\u0C9D'; // ಝ
        i += 2;
        continue;
      }
      if (two === 'tth') {
        result += '\u0CA0'; // ಠ
        i += 3;
        continue;
      }
      if (two === 'ddh') {
        result += '\u0CA2'; // ಢ
        i += 3;
        continue;
      }
    }
    
    // Single character
    const char = word[i].toLowerCase();
    
    // Vowels
    if (char === 'a') {
      result += '\u0C85'; // ಅ
    } else if (char === 'i') {
      result += '\u0C87'; // ಇ
    } else if (char === 'u') {
      result += '\u0C89'; // ಉ
    } else if (char === 'R') {
      result += '\u0C8B'; // ಋ
    } else if (char === 'e') {
      result += '\u0C8E'; // ಎ
    } else if (char === 'o') {
      result += '\u0C92'; // ಒ
    } else if (KANNADA_CONSONANTS[char]) {
      result += KANNADA_CONSONANTS[char];
    } else {
      // Unknown character, keep as is
      result += word[i];
    }
    
    i++;
  }
  
  return result;
}

/**
 * Enhance text with Kannada transliteration
 * Adds transliterated version alongside original
 */
export function enhanceWithTransliteration(text: string): {
  original: string;
  transliterated: string;
  isTransliterated: boolean;
} {
  const hasKannada = /[\u0C80-\u0CFF]/.test(text);
  const isRomanized = isRomanizedKannada(text);
  
  if (hasKannada) {
    return {
      original: text,
      transliterated: text,
      isTransliterated: false,
    };
  }
  
  if (isRomanized) {
    return {
      original: text,
      transliterated: transliterateToKannada(text),
      isTransliterated: true,
    };
  }
  
  return {
    original: text,
    transliterated: text,
    isTransliterated: false,
  };
}

// Common Romanized Kannada phrases for intent detection
export const ROMANIZED_KANNADA_PHRASES: Record<string, string> = {
  // Temple timings
  "temple samaya": "temple ಸಮಯ",
  "matha timings": "matha ಸಮಯ",
  "darshan samaya": "darshan ಸಮಯ",
  "morning time": "belagu ಸಮಯ",
  "evening time": "sanjje ಸಮಯ",
  
  // Events
  "next aaradhane": "next ಆರಾಧನೆ",
  "aaradhane naal": "aaradhane ನಾಡ್",
  "utsava": "ಉತ್ಸವ",
  
  // Greetings
  "namaskara": "ನಮಸ್ಕಾರ",
  "shubha": "ಶುಭ",
  
  // Donations
  "dana": "ದಾನ",
  "datti": "ದತ್ತಿ",
  
  // Location
  "sthana": "ಸ್ಥಾನ",
  "elalaya": "ಎಲ್ಲಿದೆ",
  
  // General
  "enu": "ಏನು", // what
  "yaaru": "ಯಾರು", // who
  "yaava": "ಯಾವಾಗ", // when
  "evu": "ಎವು", // which
  "helu": "ಹೇಳು", // tell
};
