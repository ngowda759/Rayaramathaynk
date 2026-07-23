/**
 * i18n Configuration
 * Multi-language support for English, Kannada, and Sanskrit
 */

export const locales = ["en", "kn", "sa"] as const;
export type Locale = (typeof locales)[number];
export type LocaleCode = string;

export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  kn: "ಕನ್ನಡ",
  sa: "संस्कृत",
};

export const localeNativeNames: Record<Locale, string> = {
  en: "English",
  kn: "Kannada",
  sa: "Sanskrit",
};

export const localeFlags: Record<Locale, string> = {
  en: "🇬🇧",
  kn: "🇮🇳",
  sa: "🕉️",
};

export const localeDirections: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  kn: "ltr",
  sa: "ltr",
};

export const localeDateFormats: Record<Locale, Intl.DateTimeFormatOptions> = {
  en: {
    year: "numeric",
    month: "long",
    day: "numeric",
  },
  kn: {
    year: "numeric",
    month: "long",
    day: "numeric",
  },
  sa: {
    year: "numeric",
    month: "long",
    day: "numeric",
  },
};

export interface LocaleConfig {
  code: Locale;
  name: string;
  nativeName: string;
  flag: string;
  direction: "ltr" | "rtl";
  dateFormat: Intl.DateTimeFormatOptions;
}

export const localeConfigs: Record<Locale, LocaleConfig> = {
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    flag: "🇬🇧",
    direction: "ltr",
    dateFormat: localeDateFormats.en,
  },
  kn: {
    code: "kn",
    name: localeNames.kn,
    nativeName: "Kannada",
    flag: localeFlags.kn,
    direction: "ltr",
    dateFormat: localeDateFormats.kn,
  },
  sa: {
    code: "sa",
    name: localeNames.sa,
    nativeName: "Sanskrit",
    flag: localeFlags.sa,
    direction: "ltr",
    dateFormat: localeDateFormats.sa,
  },
};

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

export function getLocaleFromPath(path: string): Locale {
  const segments = path.split("/").filter(Boolean);
  const potentialLocale = segments[0];
  
  if (potentialLocale && isValidLocale(potentialLocale)) {
    return potentialLocale;
  }
  
  return defaultLocale;
}

export function getLocaleDisplayName(locale: Locale): string {
  return localeNames[locale];
}
