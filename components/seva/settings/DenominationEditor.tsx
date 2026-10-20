"use client";

import { useId, useState, type JSX } from "react";
import { AnimatePresence, m } from "framer-motion";
import { ArrowDown, ArrowUp } from "lucide-react";

import { PendingButton } from "@/components/seva/motion/PendingButton";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Segmented } from "@/components/seva/ui/Segmented";
import { Button } from "@/components/ui/button";
import { sevaControlClass } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SETTINGS_TEXT as T } from "@/lib/seva/strings/settings";
import { cn } from "@/lib/utils";

import { LIST_ROW } from "./listMotion";
import { SavedLine } from "./ReceiptSettingsFields";

export type DenominationKind = "note" | "coin";

/** One row as the editor keeps it; the display order is its place in the list. */
export interface DenominationRow {
  kind: DenominationKind;
  valuePaise: number;
  shown: boolean;
}

export interface DenominationEditorProps {
  /** As saved, in display order. */
  initial: DenominationRow[];
  /** Temple admins and super admins (settings.edit). */
  editable: boolean;
  onSave(rows: DenominationRow[]): Promise<void>;
}

const MAX_RUPEES = 2000;
const MAX_ROWS = 40;

/** A typed value in whole rupees, 1 to 2,000 (DB §13.3, cash_denominations.value), as paise; null otherwise. */
export function parseDenominationValue(text: string): number | null {
  const clean = text.trim().replace(/,/g, "");
  if (!/^\d+$/.test(clean)) return null;
  const rupees = Number(clean);
  if (rupees < 1 || rupees > MAX_RUPEES) return null;
  return rupees * 100;
}

/** Adds a note or coin at the end, or says why it cannot be added. */
export function addDenomination(
  rows: readonly DenominationRow[],
  kind: DenominationKind,
  valueText: string,
): { ok: true; rows: DenominationRow[] } | { ok: false; message: string } {
  const valuePaise = parseDenominationValue(valueText);
  if (valuePaise === null) return { ok: false, message: T.denominationRange };
  if (rows.some((r) => r.kind === kind && r.valuePaise === valuePaise)) return { ok: false, message: T.denominationTwice };
  if (rows.length >= MAX_ROWS) return { ok: false, message: T.denominationRange };
  return { ok: true, rows: [...rows, { kind, valuePaise, shown: true }] };
}

function same(a: readonly DenominationRow[], b: readonly DenominationRow[]): boolean {
  return (
    a.length === b.length &&
    a.every((r, i) => r.kind === b[i].kind && r.valuePaise === b[i].valuePaise && r.shown === b[i].shown)
  );
}

const TH = "px-3 py-2.5 text-left text-(length:--text-meta) font-semibold text-(--muted-foreground)";
const TD = "px-3 py-2.5 align-middle";

/**
 * Cash denominations (DB §13.3, mockup `#cash-denominations`): notes and coins with values; add (kind, value 1 to
 * 2,000), remove, reorder and hide, with a preview of how day close shows them ("Rs 10 coin x count"). Coins are
 * counted by value. Changes apply from the next day close.
 */
export function DenominationEditor({ initial, editable, onSave }: DenominationEditorProps): JSX.Element {
  const id = useId();
  const [saved, setSaved] = useState<DenominationRow[]>(initial);
  const [rows, setRows] = useState<DenominationRow[]>(initial);
  const [kind, setKind] = useState<DenominationKind>("coin");
  const [valueText, setValueText] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  const dirty = !same(rows, saved);
  const disabled = !editable || busy;

  function change(next: DenominationRow[]): void {
    setRows(next);
    setSavedNote(false);
  }

  function add(): void {
    const result = addDenomination(rows, kind, valueText);
    if (!result.ok) {
      setAddError(result.message);
      return;
    }
    setAddError(null);
    setValueText("");
    change(result.rows);
  }

  function move(from: number, to: number): void {
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    change(next);
  }

  async function save(): Promise<void> {
    if (!dirty || disabled || rows.length === 0) return;
    setBusy(true);
    setSaveError(null);
    try {
      await onSave(rows);
      setSaved(rows);
      setSavedNote(true);
    } catch (err) {
      setSaveError(err instanceof Error && err.message ? err.message : T.loadFailed);
    } finally {
      setBusy(false);
    }
  }

  const shown = rows.filter((r) => r.shown);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-(length:--text-meta) text-(--muted-foreground)">{editable ? T.denominationsMeta : T.viewOnly}</p>
        {editable ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="seva-ghost" disabled={!dirty || busy} onClick={() => change(saved)}>
              {T.discard}
            </Button>
            <PendingButton disabled={!dirty || rows.length === 0} pending={busy} pendingLabel={T.saving} onClick={() => void save()}>
              {T.saveSettings}
            </PendingButton>
          </div>
        ) : null}
      </div>
      {saveError ? (
        <p role="alert" className="text-(--destructive)">
          {saveError}
        </p>
      ) : null}
      {savedNote ? (
        <SavedLine>
          <p role="status" className="text-(--ok)">
            {T.denominationsSaved}
          </p>
        </SavedLine>
      ) : null}
      {dirty && editable ? <p className="text-(length:--text-meta) text-(--muted-foreground)">{T.unsaved}</p> : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="overflow-x-auto rounded-(--radius-surface) border border-(--border) bg-(--card)">
            <table className="w-full border-collapse text-(length:--text-ui)" data-testid="denomination-table">
              <thead className="border-b border-(--border)">
                <tr>
                  <Bilingual as="th" en={T.colOrder.en} kn={T.colOrder.kn} className={TH} />
                  <Bilingual as="th" en={T.colValue.en} kn={T.colValue.kn} className={TH} />
                  <Bilingual as="th" en={T.colKind.en} kn={T.colKind.kn} className={TH} />
                  <Bilingual as="th" en={T.colShown.en} kn={T.colShown.kn} className={TH} />
                  <th className={TH}>
                    <span className="sr-only">{T.remove}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {rows.map((row, i) => {
                    const name = T.denominationName(row.kind, row.valuePaise);
                    return (
                      <m.tr
                        key={`${row.kind}-${row.valuePaise}`}
                        {...LIST_ROW}
                        className={cn("border-b border-(--border) last:border-b-0", !row.shown && "text-(--muted-foreground)")}
                      >
                        <td className={TD}>
                          <div className="flex items-center gap-1">
                            <span className="min-w-6 font-semibold tabular-nums">{i + 1}</span>
                            {editable ? (
                              <>
                                <button
                                  type="button"
                                  aria-label={T.moveUp(name)}
                                  disabled={disabled || i === 0}
                                  onClick={() => move(i, i - 1)}
                                  className="rounded p-1 text-(--muted-foreground) hover:text-(--foreground) disabled:opacity-30"
                                >
                                  <ArrowUp aria-hidden="true" className="size-4" />
                                </button>
                                <button
                                  type="button"
                                  aria-label={T.moveDown(name)}
                                  disabled={disabled || i === rows.length - 1}
                                  onClick={() => move(i, i + 1)}
                                  className="rounded p-1 text-(--muted-foreground) hover:text-(--foreground) disabled:opacity-30"
                                >
                                  <ArrowDown aria-hidden="true" className="size-4" />
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                        <td className={cn(TD, "font-semibold tabular-nums")}>{name.replace(/ (note|coin)$/, "")}</td>
                        <td className={TD}>{row.kind === "note" ? T.note.en : T.coin.en}</td>
                        <td className={TD}>
                          <Switch
                            variant="seva"
                            aria-label={T.shownSwitch(name)}
                            checked={row.shown}
                            disabled={disabled}
                            aria-disabled={disabled}
                            onCheckedChange={(next) => change(rows.map((r, j) => (j === i ? { ...r, shown: next } : r)))}
                          />
                        </td>
                        <td className={cn(TD, "text-right")}>
                          {editable ? (
                            <Button
                              variant="seva-ghost"
                              size="sm"
                              disabled={disabled || rows.length === 1}
                              title={rows.length === 1 ? T.denominationLast : undefined}
                              aria-label={`${T.remove} ${name}`}
                              onClick={() => change(rows.filter((_, j) => j !== i))}
                            >
                              {T.remove}
                            </Button>
                          ) : null}
                        </td>
                      </m.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {editable ? (
            <form
              className="flex flex-col gap-3 rounded-(--radius-surface) border border-(--border) bg-(--card) p-5"
              onSubmit={(e) => {
                e.preventDefault();
                add();
              }}
            >
              <Bilingual as="h3" en={T.addDenomination.en} kn={T.addDenomination.kn} className="text-(length:--text-h3) font-semibold" />
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-(length:--text-meta) font-semibold">{T.kind}</span>
                  <Segmented<DenominationKind>
                    name={`${id}-kind`}
                    label={T.kind}
                    value={kind}
                    onChange={setKind}
                    options={[
                      { value: "note", en: T.note.en, kn: T.note.kn, disabled },
                      { value: "coin", en: T.coin.en, kn: T.coin.kn, disabled },
                    ]}
                  />
                </div>
                <div className="flex w-[180px] flex-col gap-1.5">
                  <label htmlFor={`${id}-value`} className="text-(length:--text-meta) font-semibold">
                    {T.value}
                  </label>
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true" className="font-semibold text-(--muted-foreground)">
                      {T.rs}
                    </span>
                    <input
                      id={`${id}-value`}
                      className={cn(sevaControlClass, "tabular-nums")}
                      inputMode="numeric"
                      placeholder="50"
                      value={valueText}
                      disabled={disabled}
                      aria-invalid={addError !== null}
                      aria-describedby={addError ? `${id}-value-msg` : undefined}
                      onChange={(e) => {
                        setValueText(e.target.value);
                        setAddError(null);
                      }}
                    />
                  </div>
                </div>
                <Button type="submit" variant="seva-secondary" disabled={disabled}>
                  {T.add}
                </Button>
              </div>
              {addError ? (
                <p id={`${id}-value-msg`} role="alert" className="text-(length:--text-meta) text-(--destructive)">
                  {addError}
                </p>
              ) : null}
            </form>
          ) : null}
        </div>

        <section className="flex flex-col gap-3 rounded-(--radius-surface) border border-(--border) bg-(--card) p-5" data-testid="denomination-preview">
          <Bilingual as="h3" en={T.previewTitle.en} kn={T.previewTitle.kn} className="text-(length:--text-h3) font-semibold" />
          <p className="text-(length:--text-meta) text-(--muted-foreground)">{T.previewHint}</p>
          <ul className="flex flex-col">
            {shown.map((row) => (
              <li
                key={`${row.kind}-${row.valuePaise}`}
                className="flex items-center justify-between gap-3 border-b border-(--border) py-2 last:border-b-0"
              >
                <span>{T.denominationName(row.kind, row.valuePaise)}</span>
                <span className="text-(--muted-foreground)">{T.previewCount}</span>
              </li>
            ))}
          </ul>
          <p className="text-(length:--text-meta) text-(--muted-foreground)">{T.previewHidden}</p>
        </section>
      </div>
    </div>
  );
}

export default DenominationEditor;
