"use client";

import { useEffect, useId, useRef, useState, type JSX, type KeyboardEvent } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button, buttonVariants } from "@/components/ui/button";
import { addDays, formatSevaDate } from "@/lib/seva/time";
import { COUNTER_TEXT, shortSevaDate } from "@/lib/seva/strings/counter";
import type { CounterBootstrap } from "@/types/seva";

export interface DatesControlProps {
  sevaName: string;
  dates: string[];
  /** Several dates only for a multi-date seva; otherwise picking a day replaces the date. */
  multi: boolean;
  /** Today's business date - the earliest allowed date (C-29). */
  today: string;
  /** today + counter_days_ahead. */
  maxDate: string;
  festivals: CounterBootstrap["festivalChips"];
  onChange(dates: string[]): void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parts(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

function iso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

function clamp(date: string, min: string, max: string): string {
  return date < min ? min : date > max ? max : date;
}

/** The same day of the month `n` months on, or the month's last day when it has fewer days. */
function addMonths(date: string, n: number): string {
  const { y, m, d } = parts(date);
  const lastDay = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return iso(y, m + n, Math.min(d, lastDay));
}

/** The days shown for the month of `date`: leading blanks (null) to the first weekday, then each day. */
function monthCells(date: string): (string | null)[] {
  const { y, m } = parts(date);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [...Array.from({ length: first }, () => null), ...Array.from({ length: days }, (_, i) => iso(y, m, i + 1))];
}

function datesText(dates: string[]): string {
  return dates.length === 1 ? formatSevaDate(dates[0]) : dates.map(shortSevaDate).join(", ");
}

/**
 * The Dates control of a seva line (Design Book 9.3): a real date picker that selects several days for a multi-date
 * seva and one otherwise, from today to `counter_days_ahead` days ahead, never a past day (C-29), with quick chips for
 * the configured festival days (C-61). Keyboard: arrow keys move, Page Up / Page Down change month, Enter picks,
 * Esc closes and returns to the Dates button.
 */
export function DatesControl({ sevaName, dates, multi, today, maxDate, festivals, onChange }: DatesControlProps): JSX.Element {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(dates[0] ?? today);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const selected = new Set(dates);

  useEffect(() => {
    if (!open) return;
    const button = gridRef.current?.querySelector<HTMLButtonElement>(`button[data-date="${focused}"]`);
    button?.focus();
  }, [open, focused]);

  const chips = festivals
    .map((f) => ({ ...f, dates: f.dates.filter((d) => d >= today && d <= maxDate).sort() }))
    .filter((f) => f.dates.length > 0);

  function openPicker(): void {
    setFocused(clamp(dates[0] ?? today, today, maxDate));
    setOpen(true);
  }

  function close(): void {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function pick(date: string): void {
    setFocused(date);
    if (!multi) {
      onChange([date]);
      return;
    }
    if (selected.has(date)) {
      // A line always keeps at least one date.
      if (dates.length > 1) onChange(dates.filter((d) => d !== date));
      return;
    }
    onChange([...dates, date].sort());
  }

  /** Esc anywhere in the picker closes it; it never reaches the counter's "Esc twice clears the order". */
  function handlePickerKey(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    close();
  }

  function handleGridKey(e: KeyboardEvent<HTMLDivElement>): void {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      PageUp: () => addMonths(focused, -1),
      PageDown: () => addMonths(focused, 1),
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    setFocused(clamp(move(), today, maxDate));
  }

  const { y, m } = parts(focused);
  const cells = monthCells(focused);
  const prevMonth = clamp(addMonths(focused, -1), today, maxDate);
  const nextMonth = clamp(addMonths(focused, 1), today, maxDate);

  return (
    <div className="flex min-w-0 flex-col gap-2" data-zone="other">
      <div className="flex flex-wrap items-center gap-2">
        <button
          ref={triggerRef}
          type="button"
          className={buttonVariants({ variant: "seva-secondary", size: "sm" })}
          aria-expanded={open}
          aria-controls={`${id}-picker`}
          aria-label={COUNTER_TEXT.datesFor(sevaName)}
          onClick={() => (open ? close() : openPicker())}
        >
          {COUNTER_TEXT.dates.en}
        </button>
        <span className="text-(length:--text-ui) font-semibold">{datesText(dates)}</span>
        {dates.length > 1 ? <span className="meta">({dates.length})</span> : null}
      </div>

      {open ? (
        <div id={`${id}-picker`} onKeyDown={handlePickerKey} className="flex flex-col gap-4 border-t border-(--border) pt-4">
          {chips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Bilingual en={COUNTER_TEXT.festivalDays.en} kn={COUNTER_TEXT.festivalDays.kn} className="meta" />
              {multi
                ? chips.map((f) => (
                    <button
                      key={f.name}
                      type="button"
                      onClick={() => onChange(f.dates)}
                      className="inline-flex min-h-[30px] cursor-pointer flex-col items-start rounded-[14px] border border-[color-mix(in_oklab,var(--primary-press)_45%,transparent)] bg-(--primary-soft) px-3 py-1 text-(length:--text-meta) font-semibold"
                    >
                      {`${f.name} ${f.dates.map((d) => parts(d).d).join(" / ")} ${shortSevaDate(f.dates[0]).split(" ")[2]}`}
                      {f.nameKn ? (
                        <span className="kn" lang="kn">
                          {f.nameKn}
                        </span>
                      ) : null}
                    </button>
                  ))
                : chips.flatMap((f) =>
                    f.dates.map((d) => (
                      <button
                        key={`${f.name}-${d}`}
                        type="button"
                        onClick={() => onChange([d])}
                        className="inline-flex min-h-[30px] cursor-pointer flex-col items-start rounded-[14px] border border-[color-mix(in_oklab,var(--primary-press)_45%,transparent)] bg-(--primary-soft) px-3 py-1 text-(length:--text-meta) font-semibold"
                      >
                        {`${f.name} ${shortSevaDate(d)}`}
                        {f.nameKn ? (
                          <span className="kn" lang="kn">
                            {f.nameKn}
                          </span>
                        ) : null}
                      </button>
                    )),
                  )}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="seva-ghost"
                size="sm"
                disabled={prevMonth.slice(0, 7) === focused.slice(0, 7)}
                onClick={() => setFocused(prevMonth)}
              >
                {COUNTER_TEXT.previousMonth}
              </Button>
              <b className="text-(length:--text-ui)" aria-live="polite">
                {MONTHS[m - 1]} {y}
              </b>
              <Button
                type="button"
                variant="seva-ghost"
                size="sm"
                disabled={nextMonth.slice(0, 7) === focused.slice(0, 7)}
                onClick={() => setFocused(nextMonth)}
              >
                {COUNTER_TEXT.nextMonth}
              </Button>
            </div>
            <div
              ref={gridRef}
              role="group"
              aria-label={`${COUNTER_TEXT.chooseDates.en} - ${MONTHS[m - 1]} ${y}`}
              onKeyDown={handleGridKey}
              className="grid w-fit grid-cols-[repeat(7,42px)] gap-1"
            >
              {WEEKDAYS.map((w) => (
                <span key={w} aria-hidden="true" className="text-center text-(length:--text-meta) leading-[30px] font-semibold text-(--muted-foreground)">
                  {w}
                </span>
              ))}
              {cells.map((d, i) =>
                d === null ? (
                  <span key={`blank-${i}`} aria-hidden="true" />
                ) : (
                  <button
                    key={d}
                    type="button"
                    data-date={d}
                    aria-pressed={selected.has(d)}
                    aria-label={formatSevaDate(d)}
                    aria-current={d === today ? "date" : undefined}
                    tabIndex={d === focused ? 0 : -1}
                    disabled={d < today || d > maxDate}
                    onClick={() => pick(d)}
                    onFocus={() => setFocused(d)}
                    className={`h-10 cursor-pointer rounded-[10px] border text-(length:--text-ui) tabular-nums disabled:cursor-default disabled:bg-transparent disabled:text-[color-mix(in_oklab,var(--muted-foreground)_55%,transparent)] ${
                      selected.has(d)
                        ? "border-(--primary) bg-(--primary) font-bold text-(--primary-ink)"
                        : d === today
                          ? "border-(--primary-press) bg-transparent hover:bg-(--secondary)"
                          : "border-transparent bg-transparent hover:bg-(--secondary)"
                    }`}
                  >
                    {parts(d).d}
                  </button>
                ),
              )}
            </div>
            <Bilingual
              as="div"
              en={multi ? COUNTER_TEXT.multiDateHint.en : COUNTER_TEXT.singleDateHint.en}
              kn={multi ? COUNTER_TEXT.multiDateHint.kn : COUNTER_TEXT.singleDateHint.kn}
              className="meta"
            />
          </div>
          <div>
            <Button type="button" variant="seva-secondary" size="sm" onClick={close}>
              {COUNTER_TEXT.done.en}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default DatesControl;
