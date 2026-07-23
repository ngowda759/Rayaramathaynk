"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale, locales, localeNames, localeFlags } from "@/lib/i18n";
import { ChevronDown, Globe, Check } from "lucide-react";

interface LanguageSwitcherProps {
  variant?: "dropdown" | "buttons";
  className?: string;
  showFlag?: boolean;
  compact?: boolean;
  onLocaleChange?: (locale: string) => void;
}

export function LanguageSwitcher({
  variant = "dropdown",
  className = "",
  showFlag = true,
  compact = false,
  onLocaleChange,
}: LanguageSwitcherProps) {
  const { locale, setLocale } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLocaleChange = (newLocale: typeof locales[number]) => {
    setLocale(newLocale);
    if (onLocaleChange) {
      onLocaleChange(newLocale);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (variant === "buttons") {
    return (
      <div className={`flex items-center gap-1 ${className}`} role="group" aria-label="Language selection">
        {locales.map((loc) => (
          <button
            key={loc}
            onClick={() => handleLocaleChange(loc)}
            className={`
              flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium transition-all
              ${compact ? "px-2 py-1" : "px-3 py-1.5"}
              ${locale === loc
                ? "bg-amber-100 text-amber-800 ring-2 ring-amber-500"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900"
              }
            `}
            aria-pressed={locale === loc}
            aria-label={`Switch to ${localeNames[loc]}`}
          >
            {showFlag && <span className="text-base">{localeFlags[loc]}</span>}
            {!compact && <span>{localeNames[loc]}</span>}
            {locale === loc && <Check className="h-3 w-3" aria-hidden="true" />}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg bg-stone-100 px-3 py-2 text-sm font-medium text-stone-700 transition-all hover:bg-stone-200 hover:text-stone-900"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select language"
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
        {showFlag && <span className="text-base">{localeFlags[locale]}</span>}
        <span>{localeNames[locale]}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full z-50 mt-2 min-w-[160px] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl"
          role="listbox"
          aria-label="Language options"
        >
          <div className="p-2">
            {locales.map((loc) => (
              <button
                key={loc}
                onClick={() => {
                  handleLocaleChange(loc);
                  setIsOpen(false);
                }}
                className={`
                  flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors
                  ${locale === loc
                    ? "bg-amber-50 text-amber-800"
                    : "text-stone-700 hover:bg-stone-50"
                  }
                `}
                role="option"
                aria-selected={locale === loc}
              >
                <span className="text-lg">{localeFlags[loc]}</span>
                <span className="flex-1 font-medium">{localeNames[loc]}</span>
                {locale === loc && (
                  <Check className="h-4 w-4 text-amber-600" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function LanguageBadge({ locale, className = "" }: { locale: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 ${className}`}
      aria-label={`Language: ${localeNames[locale as keyof typeof localeNames] || locale}`}
    >
      {localeFlags[locale as keyof typeof localeFlags] || "🌐"}
      <span>{localeNames[locale as keyof typeof localeNames] || locale}</span>
    </span>
  );
}

export default LanguageSwitcher;
