"use client";

import { useRef, type JSX, type KeyboardEvent } from "react";

import { Bilingual } from "./Bilingual";

export interface SegmentedOption<T extends string> {
  value: T;
  en: string;
  kn?: string;
  /** A choice that cannot be picked now (for example UPI on a counter with no UPI id); arrow keys skip it. */
  disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
  /** Groups the radios; used for their ids. */
  name: string;
  /** Accessible name of the group. */
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange(v: T): void;
}

/**
 * One-of-few choice (payment mode, period) as an ARIA radiogroup with a roving tab stop:
 * Tab enters on the chosen option, arrow keys move and choose, Home/End jump to the ends.
 */
export function Segmented<T extends string>({ name, label, options, value, onChange }: SegmentedProps<T>): JSX.Element {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const chosen = options.findIndex((o) => o.value === value);
  const tabStop = chosen >= 0 ? chosen : 0;

  /** Moves to the option at `to`, stepping on by `step` past disabled options; does nothing if all are disabled. */
  function move(to: number, step: 1 | -1 = 1): void {
    const n = options.length;
    for (let tries = 0; tries < n; tries += 1) {
      const i = (((to + tries * step) % n) + n) % n;
      if (options[i].disabled) continue;
      refs.current[i]?.focus();
      if (options[i].value !== value) onChange(options[i].value);
      return;
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, i: number): void {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        move(i + 1);
        return;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        move(i - 1, -1);
        return;
      case "Home":
        e.preventDefault();
        move(0);
        return;
      case "End":
        e.preventDefault();
        move(options.length - 1, -1);
        return;
      default:
        return;
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex gap-1 rounded-[14px] border border-(--border) bg-(--secondary) p-1"
    >
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${name}-${o.value}`}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={i === tabStop ? 0 : -1}
            disabled={o.disabled}
            onClick={() => {
              if (!checked && !o.disabled) onChange(o.value);
            }}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={
              checked
                ? "min-h-[38px] cursor-pointer rounded-[10px] border-0 bg-(--card) px-4 py-1.5 text-(length:--text-ui) leading-tight font-semibold text-(--foreground) shadow-(--shadow-card)"
                : "min-h-[38px] cursor-pointer rounded-[10px] border-0 bg-transparent px-4 py-1.5 text-(length:--text-ui) leading-tight font-semibold text-(--muted-foreground) hover:text-(--foreground) disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:text-(--muted-foreground)"
            }
          >
            <Bilingual en={o.en} kn={o.kn} />
          </button>
        );
      })}
    </div>
  );
}

export default Segmented;
