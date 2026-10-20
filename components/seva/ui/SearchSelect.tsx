"use client";

import { useEffect, useRef, useState, type ChangeEvent, type JSX, type KeyboardEvent } from "react";
import { m, type Variants } from "framer-motion";

import { Bilingual } from "./Bilingual";

export interface SearchOption {
  value: string;
  en: string;
  kn?: string;
  aliases?: string[];
}

export type SearchSelectValue = { value?: string; text: string };

export interface SearchSelectProps {
  id: string;
  label: { en: string; kn?: string };
  options: readonly SearchOption[];
  value: SearchSelectValue | null;
  onChange(v: SearchSelectValue | null): void;
  /** Adds a last option "Use '<typed>' as entered" when the text is not in the list. */
  allowTyped?: boolean;
  placeholder?: string;
  /** Called after Enter picks an option (or Enter on an untouched field), to move to the next field. */
  onEnterNext?(): void;
  disabled?: boolean;
  /** Wording of the last option for typed text. Default: "Use '<typed>' as entered". */
  typedOptionLabel?(typed: string): string;
  /** Hint under the field when the value is typed text, not a list option. Default: "As entered - not in the list". */
  typedHint?: string;
}

type Item = { kind: "option"; option: SearchOption } | { kind: "typed"; text: string };

/** The list springs open from just under the field. */
const LIST_OPEN = { initial: { opacity: 0, y: -6, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 } } as const;
/** Options arrive one after another when the list opens; the wave is capped so the last is readable within 0.2 s. */
const OPTION_VARIANTS: Variants = {
  hidden: { opacity: 0, y: -4 },
  shown: (i: number) => ({ opacity: 1, y: 0, transition: { delay: Math.min(i, 8) * 0.025 } }),
};

/** Lower case, accents removed, so "Kṛttikā" and "krittika" compare equal. */
function fold(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** True when the query starts the whole name or any word in it. */
function startsAnyWord(name: string, q: string): boolean {
  const f = fold(name);
  if (f.startsWith(q)) return true;
  return f.split(/[\s\-/().,]+/).some((w) => w.startsWith(q));
}

function matches(options: readonly SearchOption[], query: string): SearchOption[] {
  const q = fold(query);
  if (!q) return [...options];
  const first: SearchOption[] = [];
  const rest: SearchOption[] = [];
  for (const o of options) {
    if (fold(o.en).startsWith(q)) first.push(o);
    else if ([o.en, o.kn ?? "", ...(o.aliases ?? [])].some((n) => n && startsAnyWord(n, q))) rest.push(o);
  }
  return [...first, ...rest];
}

function exactOption(options: readonly SearchOption[], text: string): SearchOption | undefined {
  const q = fold(text);
  if (!q) return undefined;
  return options.find((o) => [o.en, o.kn ?? "", ...(o.aliases ?? [])].some((n) => n && fold(n) === q));
}

function valueKey(v: SearchSelectValue | null): string | null {
  return v ? `${v.value ?? ""}\u0000${v.text}` : null;
}

/**
 * Searchable dropdown (ARIA 1.2 combobox with a listbox popup) for gotra, nakshatra, rashi and seva search.
 * Finds by prefix of the English name, the Kannada name, any word in them, or an alias. ArrowUp/ArrowDown move,
 * Enter picks, Escape closes. With `allowTyped`, the typed text can be kept "as entered".
 * The list springs open and its options stagger in when it opens from focus or the arrow key; while the person types,
 * new matches appear at once, so typing never waits on an animation.
 */
export function SearchSelect({
  id,
  label,
  options,
  value,
  onChange,
  allowTyped = false,
  placeholder,
  onEnterNext,
  disabled = false,
  typedOptionLabel = (t: string) => `Use ‘${t}’ as entered`,
  typedHint = "As entered - not in the list",
}: SearchSelectProps): JSX.Element {
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const optionId = (i: number) => `${id}-opt-${i}`;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  // Set synchronously by pick(). A blur that follows a pick in the same event (onEnterNext moving focus) runs the
  // handler from the earlier render, whose `editing` and `query` still hold the partial text; this ref stops that
  // stale blur from overwriting the pick.
  const pickedRef = useRef(false);

  // A new value from the parent (for example a returning devotee's details) ends any edit in progress.
  const key = valueKey(value);
  const [seenKey, setSeenKey] = useState(key);
  if (key !== seenKey) {
    setSeenKey(key);
    if (value) setEditing(false);
  }

  const text = editing ? query : (value?.text ?? "");
  const items: Item[] = editing
    ? matches(options, query).map((option) => ({ kind: "option", option }))
    : options.map((option) => ({ kind: "option", option }));
  const typed = query.trim();
  if (editing && allowTyped && typed && !exactOption(options, typed)) items.push({ kind: "typed", text: typed });

  const showList = open && !disabled && items.length > 0;
  const activeIndex = showList && active < items.length ? active : -1;

  useEffect(() => {
    if (activeIndex < 0) return;
    const el = document.getElementById(`${id}-opt-${activeIndex}`);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [id, activeIndex]);

  function selectedIndex(): number {
    if (editing || !value?.value) return -1;
    return options.findIndex((o) => o.value === value.value);
  }

  function openList(): void {
    if (disabled) return;
    setOpen(true);
    setActive(editing ? (typed ? 0 : -1) : selectedIndex());
  }

  function close(): void {
    setOpen(false);
    setActive(-1);
  }

  function pick(item: Item): void {
    pickedRef.current = true;
    if (item.kind === "typed") onChange({ text: item.text });
    else onChange({ value: item.option.value, text: item.option.en });
    setEditing(false);
    setQuery("");
    close();
  }

  function handleInput(e: ChangeEvent<HTMLInputElement>): void {
    const next = e.target.value;
    pickedRef.current = false;
    setQuery(next);
    setEditing(true);
    setOpen(true);
    setActive(next.trim() ? 0 : -1);
    if (value) onChange(null);
  }

  function handleBlur(): void {
    close();
    if (pickedRef.current || !editing) {
      pickedRef.current = false;
      return;
    }
    const exact = exactOption(options, typed);
    if (exact) onChange({ value: exact.value, text: exact.en });
    else if (allowTyped && typed) onChange({ text: typed });
    setEditing(false);
    setQuery("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        if (!showList) {
          openList();
          if (!editing && selectedIndex() < 0) setActive(0);
          return;
        }
        setActive(Math.min(activeIndex + 1, items.length - 1));
        return;
      }
      case "ArrowUp": {
        if (!showList) return;
        e.preventDefault();
        setActive(Math.max(activeIndex - 1, 0));
        return;
      }
      case "Enter": {
        if (showList && activeIndex >= 0) {
          e.preventDefault();
          pick(items[activeIndex]);
          onEnterNext?.();
          return;
        }
        if (editing && typed) {
          // Text that matches nothing and may not be kept: stay here so it can be corrected.
          e.preventDefault();
          return;
        }
        close();
        if (onEnterNext) {
          e.preventDefault();
          onEnterNext();
        }
        return;
      }
      case "Escape": {
        if (showList) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        return;
      }
      default:
        return;
    }
  }

  const selected = !editing && value?.value ? options.find((o) => o.value === value.value) : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Bilingual
        as="label"
        htmlFor={id}
        en={label.en}
        kn={label.kn}
        className="text-(length:--text-meta) font-semibold text-(--foreground)"
      />
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-describedby={selected?.kn || (value && !value.value) ? hintId : undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={placeholder}
          value={text}
          onChange={handleInput}
          onFocus={openList}
          onClick={() => {
            if (!showList) openList();
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="h-[46px] w-full rounded-(--radius-control) border border-(--border-strong) bg-(--input) px-4 text-(length:--text-body) text-(--foreground) transition-[border-color,box-shadow] duration-[120ms] placeholder:text-(--muted-foreground) hover:border-[color-mix(in_oklab,var(--foreground)_35%,var(--border-strong))] focus:border-(--primary-press) focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_30%,transparent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
        {showList ? (
          <m.ul
            id={listId}
            role="listbox"
            aria-label={label.en}
            initial={LIST_OPEN.initial}
            animate={LIST_OPEN.animate}
            className="absolute inset-x-0 top-[calc(100%+6px)] z-20 m-0 max-h-[280px] list-none overflow-auto rounded-[14px] border border-(--border) bg-(--card) p-1.5 shadow-(--shadow-raise)"
          >
            {items.map((item, i) => (
              <m.li
                key={item.kind === "typed" ? "__typed" : item.option.value}
                custom={i}
                variants={OPTION_VARIANTS}
                initial={editing ? false : "hidden"}
                animate="shown"
                id={optionId(i)}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => {
                  // Keep focus in the input so the pick is not undone by blur.
                  e.preventDefault();
                  pick(item);
                }}
                onMouseEnter={() => setActive(i)}
                className={
                  item.kind === "typed"
                    ? "mt-1 cursor-pointer rounded-[10px] border-t border-dashed border-(--border) px-3 py-2.5 text-(length:--text-ui) font-semibold text-(--link) aria-selected:bg-(--primary-soft)"
                    : "flex cursor-pointer flex-col rounded-[10px] px-3 py-2.5 text-(length:--text-ui) text-(--foreground) aria-selected:bg-(--primary-soft)"
                }
              >
                {item.kind === "typed" ? (
                  typedOptionLabel(item.text)
                ) : (
                  <Bilingual en={item.option.en} kn={item.option.kn} className="[&_.kn]:text-(length:--text-meta)" />
                )}
              </m.li>
            ))}
          </m.ul>
        ) : null}
      </div>
      {selected?.kn ? (
        <span id={hintId} className="kn" lang="kn">
          {selected.kn}
        </span>
      ) : value && !value.value ? (
        <span id={hintId} className="text-(length:--text-meta) text-(--muted-foreground)">
          {typedHint}
        </span>
      ) : null}
    </div>
  );
}

export default SearchSelect;
