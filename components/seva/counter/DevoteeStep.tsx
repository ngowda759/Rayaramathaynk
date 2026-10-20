"use client";

import { useMemo, type JSX, type RefObject } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { SearchSelect, type SearchOption } from "@/components/seva/ui/SearchSelect";
import { Button } from "@/components/ui/button";
import { sevaControlClass } from "@/components/ui/input";
import type { DevoteeDraft } from "@/lib/seva/counter/state";
import { counterPickLists } from "@/lib/seva/domain/lists";
import type { DomainOption } from "@/lib/seva/domain/options";
import { COMMON } from "@/lib/seva/strings/common";
import { COUNTER_TEXT } from "@/lib/seva/strings/counter";
import type { SevaLists } from "@/types/seva";

/** One returning-devotee match (online search or this PC's cached profiles), never a full phone. */
export interface DevoteeSuggestion {
  name: string;
  gotra: string | null;
  gotraId: number | null;
  nakshatraId: number | null;
  rashiId: number | null;
  phoneLast4: string | null;
  lastVisit: string;
}

export interface DevoteeStepProps {
  devotee: DevoteeDraft;
  onDevotee(patch: Partial<DevoteeDraft>): void;
  nameRef: RefObject<HTMLInputElement | null>;
  /** Moves on from a field (Enter on a pick list); after the last field it goes to step 2. */
  onEnterNext(fromId: string): void;
  suggestion: DevoteeSuggestion | null;
  onUseSuggestion(): void;
  onRejectSuggestion(): void;
  /** Set after "Use these details", until the next devotee. */
  filledFrom: { lastVisit: string } | null;
  onUndo(): void;
  /**
   * The gotra, nakshatra and rashi lists from the counter bootstrap (cached on this PC for offline use, plan A4P-5).
   * Absent: the built-in lists. Hidden gotras are not offered.
   */
  lists?: SevaLists;
  /** True while the returning-devotee search runs: a small spinner sits in the Name box (typing never waits on it). */
  searching?: boolean;
}

/** Field ids in the order Enter moves through them (Design Book 9.2, 9.6). */
export const DEVOTEE_FIELD_IDS = ["counter-name", "counter-gotra", "counter-nakshatra", "counter-rashi", "counter-phone"] as const;

function toOptions(list: readonly DomainOption[]): SearchOption[] {
  return list.map((o) => ({ value: String(o.id), en: o.en, kn: o.kn, aliases: o.aliases }));
}

function suggestionLine(s: DevoteeSuggestion, nakshatras: readonly DomainOption[]): string {
  const nakshatra = nakshatras.find((n) => n.id === s.nakshatraId)?.en;
  return [s.name, s.gotra, nakshatra].filter((t): t is string => !!t && t.trim() !== "").join(" - ");
}

function suggestionMeta(s: DevoteeSuggestion): string {
  return [s.phoneLast4 ? COUNTER_TEXT.phoneEnding(s.phoneLast4) : null, COUNTER_TEXT.lastVisit(s.lastVisit)]
    .filter((t): t is string => t !== null)
    .join(" - ");
}

/**
 * Step 1 - Devotee (Design Book 9.2, counter mockup `#counter`): name first and the only required field, gotra,
 * nakshatra and rashi as searchable pick lists with Kannada under each option, phone last. Typing a name or a full
 * phone offers a returning devotee's details, with "Use these details" / "Not this person" and an Undo after use.
 */
export function DevoteeStep({
  devotee,
  onDevotee,
  nameRef,
  onEnterNext,
  suggestion,
  onUseSuggestion,
  onRejectSuggestion,
  filledFrom,
  onUndo,
  lists,
  searching = false,
}: DevoteeStepProps): JSX.Element {
  const picks = useMemo(() => {
    const merged = counterPickLists(lists);
    return {
      nakshatras: merged.nakshatras,
      gotra: toOptions(merged.gotras),
      nakshatra: toOptions(merged.nakshatras),
      rashi: toOptions(merged.rashis),
    };
  }, [lists]);

  return (
    <section aria-label={COUNTER_TEXT.devoteeTitle.en} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Bilingual as="h2" en={COUNTER_TEXT.devoteeTitle.en} kn={COUNTER_TEXT.devoteeTitle.kn} className="text-(length:--text-h1)" />
        <Bilingual en={COUNTER_TEXT.onlyName.en} kn={COUNTER_TEXT.onlyName.kn} className="meta" />
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-5 max-md:grid-cols-1">
        <div className="col-span-full flex flex-col gap-1.5" data-zone="name">
          <Bilingual
            as="label"
            htmlFor="counter-name"
            en={COMMON.name.en}
            kn={COMMON.name.kn}
            className="text-(length:--text-meta) font-semibold"
          />
          <div className="relative">
            <input
              ref={nameRef}
              id="counter-name"
              className={`${sevaControlClass} h-[54px] pr-12 text-(length:--text-body-lg)`}
              autoComplete="off"
              spellCheck={false}
              maxLength={80}
              required
              aria-busy={searching || undefined}
              value={devotee.name}
              onChange={(e) => onDevotee({ name: e.target.value })}
            />
            {searching ? (
              <span
                aria-hidden="true"
                data-testid="devotee-searching"
                className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 animate-spin rounded-full border-2 border-(--border-strong) border-t-(--primary-press)"
              />
            ) : null}
          </div>
        </div>

        {suggestion ? (
          <div
            role="status"
            data-zone="other"
            className="col-span-full flex flex-wrap items-center justify-between gap-4 rounded-(--radius-control) border border-(--border) bg-(--primary-soft) px-4 py-3"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <Bilingual en={COUNTER_TEXT.returning.en} kn={COUNTER_TEXT.returning.kn} className="meta" />
              <b>{suggestionLine(suggestion, picks.nakshatras)}</b>
              <span className="meta">{suggestionMeta(suggestion)}</span>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="seva-primary" size="sm" onClick={onUseSuggestion}>
                {COUNTER_TEXT.useDetails.en}
              </Button>
              <Button type="button" variant="seva-ghost" size="sm" onClick={onRejectSuggestion}>
                {COUNTER_TEXT.notThisPerson.en}
              </Button>
            </div>
          </div>
        ) : null}

        {filledFrom ? (
          <p className="col-span-full m-0 flex items-center gap-2 text-(length:--text-meta) text-(--muted-foreground)" data-zone="other">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-(--ok)" />
            {COUNTER_TEXT.filledFrom(filledFrom.lastVisit)}
            <Button type="button" variant="seva-ghost" size="sm" onClick={onUndo}>
              {COUNTER_TEXT.undo.en}
            </Button>
          </p>
        ) : null}

        <div data-zone="field">
          <SearchSelect
            id="counter-gotra"
            label={COMMON.gotra}
            options={picks.gotra}
            value={devotee.gotra}
            onChange={(gotra) => onDevotee({ gotra })}
            allowTyped
            placeholder={COUNTER_TEXT.searchGotra}
            onEnterNext={() => onEnterNext("counter-gotra")}
          />
        </div>
        <div data-zone="field">
          <SearchSelect
            id="counter-nakshatra"
            label={COMMON.nakshatra}
            options={picks.nakshatra}
            value={devotee.nakshatra}
            onChange={(nakshatra) => onDevotee({ nakshatra })}
            allowTyped
            placeholder={COUNTER_TEXT.searchNakshatra}
            onEnterNext={() => onEnterNext("counter-nakshatra")}
          />
        </div>
        <div data-zone="field">
          <SearchSelect
            id="counter-rashi"
            label={COMMON.rashi}
            options={picks.rashi}
            value={devotee.rashi}
            onChange={(rashi) => onDevotee({ rashi })}
            allowTyped
            placeholder={COUNTER_TEXT.searchRashi}
            onEnterNext={() => onEnterNext("counter-rashi")}
          />
        </div>
        <div className="flex flex-col gap-1.5" data-zone="field">
          <Bilingual
            as="label"
            htmlFor="counter-phone"
            en={COUNTER_TEXT.phone.en}
            kn={COUNTER_TEXT.phone.kn}
            className="text-(length:--text-meta) font-semibold"
          />
          <div className="relative">
            <span aria-hidden="true" className="absolute top-1/2 left-4 -translate-y-1/2 text-(--muted-foreground)">
              +91
            </span>
            <input
              id="counter-phone"
              className={`${sevaControlClass} num pl-[52px]`}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              maxLength={16}
              aria-describedby="counter-phone-hint"
              value={devotee.phone}
              onChange={(e) => onDevotee({ phone: e.target.value })}
            />
          </div>
          <span id="counter-phone-hint" className="meta">
            {COUNTER_TEXT.phoneHint.en}
          </span>
        </div>
      </div>

      <Bilingual as="div" en={COUNTER_TEXT.privacy.en} kn={COUNTER_TEXT.privacy.kn} className="meta" />

      <div className="flex items-center justify-between gap-4 border-t border-(--border) pt-5">
        <span className="meta">{COUNTER_TEXT.stepOf(1)}</span>
        <span className="meta">Enter - {COUNTER_TEXT.steps.sevas.en}</span>
      </div>
    </section>
  );
}

export default DevoteeStep;
