"use client";

import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
} from "react";
import { Locale, defaultLocale, locales, isValidLocale } from "./config";
import { Dictionary, getDictionary } from "./dictionaries";

interface I18nContextType {
  locale: Locale;
  dictionary: Dictionary | null;
  isLoading: boolean;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  direction: "ltr" | "rtl";
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const LOCALE_STORAGE_KEY = "preferred-locale";

function getNestedValue(obj: any, path: string): string | undefined {
  const keys = path.split(".");
  let result = obj;
  
  for (const key of keys) {
    if (result && typeof result === "object" && key in result) {
      result = result[key];
    } else {
      return undefined;
    }
  }
  
  return typeof result === "string" ? result : undefined;
}

function interpolate(
  text: string,
  params?: Record<string, string | number>
): string {
  if (!params) return text;
  
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return params[key]?.toString() ?? `{{${key}}}`;
  });
}

export function I18nProvider({
  children,
  initialLocale = defaultLocale,
  initialDictionary,
}: {
  children: ReactNode;
  initialLocale?: Locale;
  initialDictionary?: Dictionary;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [dictionary, setDictionary] = useState<Dictionary | null>(
    initialDictionary ?? null
  );
  const [isLoading, setIsLoading] = useState(!initialDictionary);

  // Load dictionary when locale changes
  useEffect(() => {
    let mounted = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Data fetching pattern
    setIsLoading(true);

    getDictionary(locale).then((dict) => {
      if (mounted) {
         
        setDictionary(dict);
         
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [locale]);

  // Persist locale preference
  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
      document.documentElement.lang = newLocale;
    }
  }, []);

  // Load saved locale on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (savedLocale && isValidLocale(savedLocale) && savedLocale !== locale) {
      setLocaleState(savedLocale as Locale);
    }
  }, []);

  // Translation function
  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      if (!dictionary) return key;
      
      const value = getNestedValue(dictionary, key);
      if (value === undefined) {
        console.warn(`Translation missing for key: ${key}`);
        return key;
      }
      
      return interpolate(value, params);
    },
    [dictionary]
  );

  const direction = locale === "sa" ? "rtl" : "ltr";

  return (
    <I18nContext.Provider
      value={{
        locale,
        dictionary,
        isLoading,
        setLocale,
        t,
        direction,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  
  if (context === undefined) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  
  return context;
}

export function useTranslation() {
  const { t, locale, dictionary } = useI18n();
  
  return { t, locale, dictionary };
}

export function useLocale() {
  const { locale, setLocale } = useI18n();
  
  return {
    locale,
    setLocale,
    locales,
    isCurrentLocale: (l: string) => l === locale,
  };
}

export function useDirection() {
  const { direction } = useI18n();
  
  return {
    direction,
    isRTL: direction === "rtl",
    isLTR: direction === "ltr",
  };
}

export function useDateFormatter() {
  const { locale } = useI18n();
  
  const formatDate = useCallback(
    (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
      const d = typeof date === "string" ? new Date(date) : date;
      return d.toLocaleDateString(locale === "kn" ? "kn-IN" : locale === "sa" ? "sa-IN" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        ...options,
      });
    },
    [locale]
  );
  
  const formatTime = useCallback(
    (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
      const d = typeof date === "string" ? new Date(date) : date;
      return d.toLocaleTimeString(locale === "kn" ? "kn-IN" : locale === "sa" ? "sa-IN" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
        ...options,
      });
    },
    [locale]
  );
  
  const formatDateTime = useCallback(
    (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
      const d = typeof date === "string" ? new Date(date) : date;
      return d.toLocaleString(locale === "kn" ? "kn-IN" : locale === "sa" ? "sa-IN" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        ...options,
      });
    },
    [locale]
  );
  
  return {
    formatDate,
    formatTime,
    formatDateTime,
  };
}
