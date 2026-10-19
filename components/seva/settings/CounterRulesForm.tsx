"use client";

import { useState, type FormEvent, type JSX } from "react";

import { PendingButton } from "@/components/seva/motion/PendingButton";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { fromPaise, toPaise } from "@/lib/seva/money";
import type { Bi } from "@/lib/seva/strings/common";
import { RS } from "@/lib/seva/strings/receipt-settings";
import type { RulesPatch } from "@/services/seva/settings.service";
import type { CounterRules } from "@/types/seva-settings";

import { errorText, Notice, SettingsCard, TextField } from "./ReceiptSettingsFields";

/**
 * Settings - Counter rules (DB §13.2): the cancel window, how many days ahead the counter may book, and the day-close
 * flag threshold. The note for a cash difference and the reason for a changed amount are always required (the server
 * has no switch for them), so they show as locked on. Saving sends only these three fields; the office writes the audit
 * row with the change (DB §13: every save is audited).
 */

export interface CounterRulesFormProps {
  value: CounterRules;
  readOnly: boolean;
  save(patch: RulesPatch): Promise<void>;
  onSaved?(patch: RulesPatch): void;
}

type Draft = { cancel: string; days: string; threshold: string };

function draftOf(v: CounterRules): Draft {
  return {
    cancel: String(v.cancelWindowMinutes),
    days: String(v.counterDaysAhead),
    threshold: fromPaise(v.dayCloseFlagThresholdPaise).replace(/\.00$/, ""),
  };
}

function wholeIn(text: string, min: number, max: number): number | null {
  const t = text.trim();
  if (!/^\d{1,4}$/.test(t)) return null;
  const n = Number(t);
  return n >= min && n <= max ? n : null;
}

function rupeesToPaise(text: string): number | null {
  const t = text.replace(/^\s*(rs\.?|₹)\s*/i, "").replace(/,/g, "").trim();
  if (t === "") return null;
  try {
    return toPaise(t);
  } catch {
    return null;
  }
}

function LockedSwitch({ id, label, hint }: { id: string; label: Bi; hint: Bi }): JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--border) py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Bilingual en={label.en} kn={label.kn} className="font-semibold" />
        <Bilingual en={hint.en} kn={hint.kn} className="meta" />
      </div>
      <div className="flex items-center gap-2">
        <span id={`${id}-state`} className="meta">
          {RS.alwaysRequired.en}
        </span>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked="true"
          aria-label={label.en}
          aria-describedby={`${id}-state`}
          disabled
          className="relative inline-flex h-[26px] w-11 shrink-0 items-center rounded-full border-[3px] border-(--primary-press) bg-(--primary-press) opacity-70"
        >
          <span aria-hidden="true" className="ml-[18px] block size-5 rounded-full bg-white shadow-[0_1px_2px_oklch(0_0_0/0.2)]" />
        </button>
      </div>
    </div>
  );
}

export function CounterRulesForm({ value, readOnly, save, onSaved }: CounterRulesFormProps): JSX.Element {
  const [draft, setDraft] = useState<Draft>(() => draftOf(value));
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "ok" | "error"; text: Bi | string } | null>(null);

  const cancel = wholeIn(draft.cancel, 0, 240);
  const days = wholeIn(draft.days, 0, 999);
  const threshold = rupeesToPaise(draft.threshold);

  function edit(key: keyof Draft, text: string) {
    setDraft((d) => ({ ...d, [key]: text }));
    setResult(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (readOnly || busy) return;
    setChecked(true);
    if (cancel === null || days === null || threshold === null) return;
    const patch: RulesPatch = { cancelWindowMinutes: cancel, counterDaysAhead: days, dayCloseFlagThresholdPaise: threshold };
    setBusy(true);
    setResult(null);
    try {
      await save(patch);
      setResult({ kind: "ok", text: RS.saved });
      onSaved?.(patch);
    } catch (err) {
      setResult({ kind: "error", text: errorText(err, RS.loadFailed) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <SettingsCard title={RS.rulesTitle} hint={RS.appliesAfterSave} testId="counter-rules">
        <div className="flex flex-col">
          <div className="grid grid-cols-1 gap-4 py-3 md:grid-cols-3">
            <TextField
              id="rules-cancel-window"
              label={{ en: `${RS.cancelWindow.en} (${RS.minutes.en})`, kn: `${RS.cancelWindow.kn} (${RS.minutes.kn})` }}
              hint={RS.cancelWindowHint}
              value={draft.cancel}
              onChange={(v) => edit("cancel", v)}
              inputMode="numeric"
              readOnly={readOnly}
              maxLength={4}
              error={checked && cancel === null ? RS.cancelWindowInvalid.en : null}
            />
            <TextField
              id="rules-days-ahead"
              label={{ en: `${RS.daysAhead.en} (${RS.days.en})`, kn: `${RS.daysAhead.kn} (${RS.days.kn})` }}
              hint={RS.daysAheadHint}
              value={draft.days}
              onChange={(v) => edit("days", v)}
              inputMode="numeric"
              readOnly={readOnly}
              maxLength={4}
              error={checked && days === null ? RS.daysAheadInvalid.en : null}
            />
            <TextField
              id="rules-flag-threshold"
              label={RS.flagThreshold}
              hint={RS.flagThresholdHint}
              value={draft.threshold}
              onChange={(v) => edit("threshold", v)}
              inputMode="decimal"
              readOnly={readOnly}
              maxLength={12}
              error={checked && threshold === null ? RS.thresholdInvalid.en : null}
            />
          </div>
          <LockedSwitch id="rules-cash-note" label={RS.cashNote} hint={RS.cashNoteHint} />
          <LockedSwitch id="rules-amount-reason" label={RS.amountReason} hint={RS.amountReasonHint} />
        </div>
        {result ? <Notice kind={result.kind} text={result.text} /> : null}
        {readOnly ? (
          <Bilingual as="div" en={RS.viewOnly.en} kn={RS.viewOnly.kn} className="meta" />
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="seva-ghost"
              disabled={busy}
              onClick={() => {
                setDraft(draftOf(value));
                setChecked(false);
                setResult(null);
              }}
            >
              {RS.discard.en}
            </Button>
            <PendingButton type="submit" pending={busy} pendingLabel={RS.saving.en}>
              {RS.save.en}
            </PendingButton>
          </div>
        )}
      </SettingsCard>
    </form>
  );
}

export default CounterRulesForm;
