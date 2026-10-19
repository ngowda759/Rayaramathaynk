"use client";

import { useState, type JSX, type RefObject } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Chip } from "@/components/seva/ui/Chip";
import { Button } from "@/components/ui/button";
import { sevaControlClass } from "@/components/ui/input";
import type { CounterLine } from "@/lib/seva/grouping";
import { MAX_QUANTITY, type CatalogueIndex } from "@/lib/seva/counter/state";
import { fromPaise, toPaise } from "@/lib/seva/money";
import { COUNTER_TEXT, rupees } from "@/lib/seva/strings/counter";
import type { CatalogueSeva, CounterBootstrap } from "@/types/seva";
import { AmountChangeDialog } from "./AmountChangeDialog";
import { DatesControl } from "./DatesControl";
import { SevaTiles } from "./SevaTiles";

export interface SevasStepProps {
  search: string;
  onSearch(text: string): void;
  searchRef: RefObject<HTMLInputElement | null>;
  /** Counter sevas filtered by the search (matchSevas). */
  matches: CatalogueSeva[];
  lines: CounterLine[];
  catalogue: CatalogueIndex;
  today: string;
  maxDate: string;
  festivals: CounterBootstrap["festivalChips"];
  /** The signed-in person may change amounts (counter.change_amount). */
  canChangeAmount: boolean;
  onAdd(key: number): void;
  onRemove(lineKey: string): void;
  onQuantity(lineKey: string, quantity: number): void;
  onDates(lineKey: string, dates: string[]): void;
  onAmount(lineKey: string, unitRatePaise: number, reason: string): void;
  onBack(): void;
}

function isChanged(line: CounterLine): boolean {
  return line.catalogueRatePaise !== null && line.unitRatePaise !== line.catalogueRatePaise;
}

/** The typed amount of an "Any amount" seva (Other Seva / Karnike): not a changed amount, no reason (DB 9.3). */
function AnyAmountInput({ line, sevaName, onAmount }: { line: CounterLine; sevaName: string; onAmount: SevasStepProps["onAmount"] }): JSX.Element {
  const [text, setText] = useState(line.unitRatePaise > 0 ? fromPaise(line.unitRatePaise).replace(/\.00$/, "") : "");
  const id = `counter-any-${line.key}`;
  return (
    <div className="flex flex-col gap-1">
      <Bilingual as="label" htmlFor={id} en={COUNTER_TEXT.amount.en} kn={COUNTER_TEXT.amount.kn} className="text-(length:--text-meta) font-semibold" />
      <input
        id={id}
        aria-label={`${COUNTER_TEXT.amount.en} - ${sevaName}`}
        className={`${sevaControlClass} amount max-w-[180px]`}
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(e) => {
          const next = e.target.value.replace(/[^\d.]/g, "");
          setText(next);
          let paise = 0;
          try {
            paise = next.trim() === "" ? 0 : toPaise(next);
          } catch {
            paise = 0;
          }
          onAmount(line.key, paise, "");
        }}
      />
    </div>
  );
}

/**
 * Step 2 - Sevas and dates (Design Book 9.3, 9.4; counter mockup `#counter-sevas`): find a seva by number, code or
 * name (Enter adds it; Enter on an empty search goes to step 3), the lines on this order with quantity, dates and
 * "Change amount", and the roomy tile grid (1-9 adds the nth seva while focus is in it).
 */
export function SevasStep({
  search,
  onSearch,
  searchRef,
  matches,
  lines,
  catalogue,
  today,
  maxDate,
  festivals,
  canChangeAmount,
  onAdd,
  onRemove,
  onQuantity,
  onDates,
  onAmount,
  onBack,
}: SevasStepProps): JSX.Element {
  const [changing, setChanging] = useState<string | null>(null);
  const changingLine = lines.find((l) => l.key === changing) ?? null;
  const changingSeva = changingLine ? catalogue.byId.get(changingLine.sevaId) : undefined;

  return (
    <section aria-label={COUNTER_TEXT.sevasTitle.en} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Bilingual as="h2" en={COUNTER_TEXT.sevasTitle.en} kn={COUNTER_TEXT.sevasTitle.kn} className="text-(length:--text-h1)" />
        <Bilingual en={COUNTER_TEXT.sevasHint.en} kn={COUNTER_TEXT.sevasHint.kn} className="meta" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Bilingual
          as="label"
          htmlFor="counter-seva-search"
          en={COUNTER_TEXT.findSeva.en}
          kn={COUNTER_TEXT.findSeva.kn}
          className="text-(length:--text-meta) font-semibold"
        />
        <input
          ref={searchRef}
          id="counter-seva-search"
          type="text"
          inputMode="search"
          data-zone="search"
          className={`${sevaControlClass} h-[54px] text-(length:--text-body-lg)`}
          placeholder={COUNTER_TEXT.findSevaPlaceholder}
          autoComplete="off"
          spellCheck={false}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-3">
        <Bilingual en={COUNTER_TEXT.onThisReceipt.en} kn={COUNTER_TEXT.onThisReceipt.kn} className="text-(length:--text-meta) font-semibold" />
        {lines.length === 0 ? (
          <Bilingual
            as="div"
            en={COUNTER_TEXT.noLinesYet.en}
            kn={COUNTER_TEXT.noLinesYet.kn}
            className="rounded-[14px] border border-dashed border-(--border-strong) p-5 text-center text-(length:--text-ui) text-(--muted-foreground)"
          />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label={COUNTER_TEXT.onThisReceipt.en}>
            {lines.map((line) => {
              const seva = catalogue.byId.get(line.sevaId);
              const name = seva?.nameEn ?? line.sevaId;
              const anyAmount = line.catalogueRatePaise === null;
              const dateCount = new Set(line.dates).size;
              const amountPaise = line.quantity * line.unitRatePaise * dateCount;
              return (
                <li key={line.key} data-line-key={line.key} className="flex flex-col gap-4 rounded-[16px] border border-(--border) bg-(--card) px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="grid size-[30px] shrink-0 place-items-center rounded-full bg-(--primary) text-[14px] font-bold text-(--primary-ink)"
                    >
                      {seva?.key ?? "?"}
                    </span>
                    <span className="flex min-w-0 grow flex-col">
                      <b className="text-(length:--text-ui)">{name}</b>
                      {seva?.nameKn ? (
                        <span className="kn" lang="kn">
                          {seva.nameKn}
                        </span>
                      ) : null}
                      {isChanged(line) ? (
                        <span className="mt-1 flex flex-wrap items-center gap-2">
                          <Chip tone="attention">{COUNTER_TEXT.changed.en}</Chip>
                          <span className="meta">{line.changeReason ?? ""}</span>
                        </span>
                      ) : null}
                    </span>
                    <span className="flex flex-col items-end text-right">
                      <span className="amount text-[18px] font-semibold">{rupees(amountPaise)}</span>
                      <span className="meta">
                        {line.quantity} x {rupees(line.unitRatePaise)}
                        {dateCount > 1 ? ` x ${dateCount}` : ""}
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
                    <div className="flex flex-col gap-1">
                      <Bilingual en={COUNTER_TEXT.quantity.en} kn={COUNTER_TEXT.quantity.kn} className="text-(length:--text-meta) font-semibold" />
                      <div className="inline-flex items-center gap-2" role="group" aria-label={`${COUNTER_TEXT.quantity.en} - ${name}`}>
                        <Button
                          type="button"
                          variant="seva-secondary"
                          size="icon-sm"
                          aria-label={COUNTER_TEXT.less}
                          disabled={line.quantity <= 1}
                          onClick={() => onQuantity(line.key, line.quantity - 1)}
                        >
                          -
                        </Button>
                        <span className="num min-w-6 text-center text-[17px] font-semibold" aria-live="polite">
                          {line.quantity}
                        </span>
                        <Button
                          type="button"
                          variant="seva-secondary"
                          size="icon-sm"
                          aria-label={COUNTER_TEXT.more}
                          disabled={line.quantity >= MAX_QUANTITY}
                          onClick={() => onQuantity(line.key, line.quantity + 1)}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                    {anyAmount ? <AnyAmountInput line={line} sevaName={name} onAmount={onAmount} /> : null}
                    <div className="min-w-0 grow">
                      <DatesControl
                        sevaName={name}
                        dates={line.dates}
                        multi={seva?.multiDate ?? false}
                        today={today}
                        maxDate={maxDate}
                        festivals={festivals}
                        onChange={(dates) => onDates(line.key, dates)}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      {!anyAmount && seva?.allowAmountChange && canChangeAmount ? (
                        <Button type="button" variant="seva-ghost" size="sm" onClick={() => setChanging(line.key)}>
                          {COUNTER_TEXT.changeAmount.en}
                        </Button>
                      ) : null}
                      <Button type="button" variant="seva-ghost" size="sm" aria-label={`${COUNTER_TEXT.remove.en} ${name}`} onClick={() => onRemove(line.key)}>
                        {COUNTER_TEXT.remove.en}
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <Bilingual en={COUNTER_TEXT.allSevas.en} kn={COUNTER_TEXT.allSevas.kn} className="text-(length:--text-meta) font-semibold" />
        <SevaTiles sevas={matches} pickedIds={new Set(lines.map((l) => l.sevaId))} onAdd={onAdd} />
        <Bilingual en={COUNTER_TEXT.tilesHint.en} kn={COUNTER_TEXT.tilesHint.kn} className="meta" />
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-(--border) pt-5">
        <Button type="button" variant="seva-secondary" onClick={onBack}>
          {COUNTER_TEXT.back.en}
        </Button>
        <span className="meta">{COUNTER_TEXT.stepOf(2)}</span>
      </div>

      {changingLine && changingSeva && changingLine.catalogueRatePaise !== null ? (
        <AmountChangeDialog
          sevaName={changingSeva.nameEn}
          catalogueRatePaise={changingLine.catalogueRatePaise}
          currentRatePaise={changingLine.unitRatePaise}
          currentReason={changingLine.changeReason ?? ""}
          onApply={(paise, reason) => onAmount(changingLine.key, paise, reason)}
          onClose={() => setChanging(null)}
        />
      ) : null}
    </section>
  );
}

export default SevasStep;
