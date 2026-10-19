"use client";

import { useId, useRef, type JSX, type KeyboardEvent } from "react";
import { m } from "framer-motion";

import { PRESS } from "@/lib/seva/motion";

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
 * The chosen option's raised pill slides to a new choice (a shared `layoutId`), and options spring when pressed.
 */
export function Segmented<T extends string>({ name, label, options, value, onChange }: SegmentedProps<T>): JSX.Element {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // One pill per group, so two Segmented controls on a page never trade pills.
  const pillId = `segmented-pill-${useId()}`;
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
          <m.button
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
            whileTap={o.disabled ? undefined : PRESS}
            className={
              checked
                ? "relative min-h-[38px] cursor-pointer rounded-[10px] border-0 bg-transparent px-4 py-1.5 text-(length:--text-ui) leading-tight font-semibold text-(--foreground)"
                : "relative min-h-[38px] cursor-pointer rounded-[10px] border-0 bg-transparent px-4 py-1.5 text-(length:--text-ui) leading-tight font-semibold text-(--muted-foreground) hover:text-(--foreground) disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:text-(--muted-foreground)"
            }
          >
            {checked ? (
              <m.span
                layoutId={pillId}
                data-segmented-pill=""
                aria-hidden="true"
                className="absolute inset-0 rounded-[10px] bg-(--card) shadow-(--shadow-card)"
              />
            ) : null}
            <span className="relative">
              <Bilingual en={o.en} kn={o.kn} />
            </span>
          </m.button>
        );
      })}
    </div>
  );
}

export default Segmented;
