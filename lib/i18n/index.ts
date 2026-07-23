/**
 * i18n Module - Multi-language Support
 * 
 * Exports:
 * - config: Locale configurations and utilities
 * - context: React context and hooks
 * - dictionaries: Translation types and loaders
 */

export {
  locales,
  defaultLocale,
  localeNames,
  localeNativeNames,
  localeFlags,
  localeDirections,
  localeConfigs,
  localeDateFormats,
  isValidLocale,
  getLocaleFromPath,
  getLocaleDisplayName,
  type Locale,
  type LocaleCode,
  type LocaleConfig,
} from "./config";

export {
  type Dictionary,
  type DictionaryKey,
  type DictionaryLoader,
  getDictionary,
  dictionaryLoaders,
} from "./dictionaries";

export {
  I18nProvider,
  useI18n,
  useTranslation,
  useLocale,
  useDirection,
  useDateFormatter,
} from "./context";
