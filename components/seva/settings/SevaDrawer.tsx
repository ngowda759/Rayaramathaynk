"use client";

import { useId, useState, type JSX, type ReactNode } from "react";

import { RateHistory } from "@/components/seva/settings/RateHistory";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Segmented } from "@/components/seva/ui/Segmented";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { sevaControlClass } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toPaise } from "@/lib/seva/money";
import type { SevaUpsert } from "@/lib/seva/schemas";
import { SETTINGS_TEXT as T, VISIBILITY_LABEL } from "@/lib/seva/strings/settings";
import { cn } from "@/lib/utils";
import type { CatalogueApi } from "@/services/seva/catalogue.service";
import { SevaClientError } from "@/services/seva/http";
import type { CatalogueSeva } from "@/types/seva";
import type { SaveSevaResult } from "@/types/seva-settings";

/** What the drawer needs from catalogueApi (services/seva/catalogue.service.ts). */
export type SevaDrawerApi = Pick<CatalogueApi, "save" | "history">;

export interface SevaDrawerProps {
  /** The seva shown; null adds a new one. */
  seva: CatalogueSeva | null;
  /** The counter key a new seva gets unless changed (the next free key). */
  nextKey: number;
  /** Every seva in the catalogue, so a key another seva already uses is refused. */
  sevas: readonly CatalogueSeva[];
  /** View-only temple admins: every field is shown but nothing can be changed (DB §13). */
  readOnly: boolean;
  api: SevaDrawerApi;
  onClose(): void;
  onSaved(result: SaveSevaResult): void;
}

type Visibility = CatalogueSeva["visibility"];

interface Form {
  code: string;
  key: string;
  nameEn: string;
  nameKn: string;
  rate: string;
  anyAmount: boolean;
  visibility: Visibility;
  multiDate: boolean;
  allowAmountChange: boolean;
  prasadamGiven: boolean;
  prasadamItems: string;
  active: boolean;
  reason: string;
}

/** A new seva's category when the drawer adds one (the table needs one; the drawer does not ask, DB §13.1). */
const NEW_SEVA_CATEGORY = "Seva";
const REASON_MIN = 3;

function rupeesText(paise: number): string {
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

function formOf(seva: CatalogueSeva | null, nextKey: number): Form {
  return {
    code: seva?.code ?? "",
    key: String(seva?.key ?? nextKey),
    nameEn: seva?.nameEn ?? "",
    nameKn: seva?.nameKn ?? "",
    rate: seva?.ratePaise == null ? "" : rupeesText(seva.ratePaise),
    anyAmount: seva !== null && seva.ratePaise === null,
    visibility: seva?.visibility ?? "both",
    multiDate: seva?.multiDate ?? false,
    allowAmountChange: seva?.allowAmountChange ?? false,
    prasadamGiven: seva?.prasadamGiven ?? true,
    prasadamItems: seva?.prasadamItems ?? "",
    active: seva?.active ?? true,
    reason: "",
  };
}

/** The typed rate in paise, or null when it is not a positive rupee amount. */
export function parseRate(text: string): number | null {
  try {
    const paise = toPaise(text.replace(/,/g, ""));
    return paise > 0 ? paise : null;
  } catch {
    return null;
  }
}

/**
 * Whether the save changes an existing seva's rate, which the office needs a reason for (DB §13.1, C-35). An
 * any-amount seva keeps no rate, so switching to any amount is not a rate change.
 */
export function rateChanges(seva: CatalogueSeva | null, anyAmount: boolean, newRatePaise: number | null): boolean {
  if (seva === null || anyAmount || newRatePaise === null) return false;
  return seva.ratePaise !== newRatePaise;
}

interface Problems {
  code?: string;
  key?: string;
  nameEn?: string;
  nameKn?: string;
  rate?: string;
  prasadamItems?: string;
  reason?: string;
}

/**
 * Whether the typed key is the seva's stored one, untouched. A migrated seva may keep a legacy key of 0, which the
 * drawer leaves alone rather than forcing the admin to invent a new one.
 */
function keyUntouched(form: Pick<Form, "key">, seva: CatalogueSeva | null): boolean {
  return seva !== null && form.key.trim() === String(seva.key);
}

/** The problem with the typed counter key, if any: out of range, or already used by another seva. */
export function keyProblem(form: Pick<Form, "key">, seva: CatalogueSeva | null, sevas: readonly CatalogueSeva[]): string | undefined {
  if (keyUntouched(form, seva)) return undefined;
  const key = Number(form.key);
  if (!/^\d+$/.test(form.key.trim()) || key < 1 || key > 999) return T.errKey;
  const taken = sevas.find((s) => s.key === key && s.id !== seva?.id);
  return taken ? T.errKeyTaken(key, taken.nameEn) : undefined;
}

function problemsOf(form: Form, seva: CatalogueSeva | null, sevas: readonly CatalogueSeva[]): Problems {
  const p: Problems = {};
  const code = form.code.trim();
  if (code !== "" && !/^[A-Z]{2,3}$/.test(code)) p.code = T.errCode;
  const keyErr = keyProblem(form, seva, sevas);
  if (keyErr) p.key = keyErr;
  const nameEn = form.nameEn.trim();
  if (nameEn.length < 1 || nameEn.length > 80) p.nameEn = T.errName;
  if (form.nameKn.trim().length > 80) p.nameKn = T.errName;
  const rate = form.anyAmount ? null : parseRate(form.rate);
  if (!form.anyAmount && rate === null) p.rate = T.errRate;
  if (form.prasadamItems.trim().length > 200) p.prasadamItems = T.errPrasadam;
  if (rateChanges(seva, form.anyAmount, rate) && form.reason.trim().length < REASON_MIN) p.reason = T.reasonNeeded;
  return p;
}

/**
 * The SevaUpsert the routes take (lib/seva/schemas.ts sevaUpsertSchema); `reason` goes separately. The key is sent only
 * when it changes (or for a new seva): the office then leaves display_order alone, so a legacy key of 0 still saves.
 */
export function toUpsert(form: Form, seva: CatalogueSeva | null): SevaUpsert {
  const nameKn = form.nameKn.trim();
  const items = form.prasadamItems.trim();
  const code = form.code.trim();
  const upsert: SevaUpsert = {
    code: code === "" ? null : code,
    nameEn: form.nameEn.trim(),
    nameKn: nameKn === "" ? null : nameKn,
    ratePaise: form.anyAmount ? null : parseRate(form.rate),
    anyAmount: form.anyAmount,
    // Other Seva / Karnike is always counter-only (C-38).
    visibility: form.anyAmount ? "counter" : form.visibility,
    multiDate: form.multiDate,
    // An any-amount seva always lets the counter change the amount; the drawer shows it on and locked.
    allowAmountChange: form.anyAmount ? true : form.allowAmountChange,
    prasadamGiven: form.prasadamGiven,
    prasadamItems: items === "" ? null : items,
    category: seva?.category ?? NEW_SEVA_CATEGORY,
    incomeLedger: seva?.incomeLedger ?? null,
    active: form.active,
  };
  if (seva) upsert.id = seva.id;
  if (!keyUntouched(form, seva)) upsert.key = Number(form.key);
  return upsert;
}

/** A catalogue seva as it is, ready to save again (the list's Active switch changes only `active`; no key is sent). */
export function catalogueToUpsert(seva: CatalogueSeva): SevaUpsert {
  return toUpsert(formOf(seva, seva.key), seva);
}

function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: { en: string; kn: string };
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Bilingual as="label" htmlFor={id} en={label.en} kn={label.kn} className="text-(length:--text-meta) font-semibold" />
      {children}
      {error ? (
        <span id={`${id}-msg`} className="text-(length:--text-meta) text-(--destructive)">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-msg`} className="text-(length:--text-meta) text-(--muted-foreground)">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function SwitchRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: { en: string; kn: string };
  hint?: string;
  checked: boolean;
  disabled: boolean;
  onChange(next: boolean): void;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-(--border) py-3 last:border-b-0">
      <div className="min-w-0">
        <Bilingual en={label.en} kn={label.kn} className="font-semibold" />
        {hint ? <p className="text-(length:--text-meta) text-(--muted-foreground)">{hint}</p> : null}
      </div>
      <Switch
        variant="seva"
        aria-label={label.en}
        aria-disabled={disabled}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onChange(next)}
      />
    </div>
  );
}

/**
 * Edit or add one seva (DB §13.1, mockup `sevas-drawer`): short code, counter key, names, rate (a change shows the old
 * rate and needs a reason, C-35), shown on, several dates, amount change, prasadam, active and the rate history. Other
 * Seva / Karnike - an any-amount seva - is always counter-only (C-38). Sevas are switched off, never deleted.
 */
export function SevaDrawer({ seva, nextKey, sevas, readOnly, api, onClose, onSaved }: SevaDrawerProps): JSX.Element {
  const id = useId();
  const [form, setForm] = useState<Form>(() => formOf(seva, nextKey));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problems = problemsOf(form, seva, sevas);
  const valid = Object.keys(problems).length === 0;
  const newRate = form.anyAmount ? null : parseRate(form.rate);
  const changingRate = rateChanges(seva, form.anyAmount, newRate);
  const disabled = readOnly || busy;

  function set<K extends keyof Form>(key: K, value: Form[K]): void {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setAnyAmount(next: boolean): void {
    setForm((f) => ({ ...f, anyAmount: next, visibility: next ? "counter" : f.visibility }));
  }

  async function save(): Promise<void> {
    if (!valid || disabled) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.save(toUpsert(form, seva), changingRate ? form.reason.trim() : undefined);
      onSaved(result);
    } catch (err) {
      setError(err instanceof SevaClientError ? err.message : T.loadFailed);
    } finally {
      setBusy(false);
    }
  }

  const title = readOnly ? T.viewSeva : seva ? T.editSeva : T.newSeva;
  const visibility = form.anyAmount ? "counter" : form.visibility;

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent
        variant="seva"
        className="top-0 right-0 left-auto flex h-dvh max-h-dvh w-[min(520px,100%)] translate-x-0 translate-y-0 flex-col gap-5 overflow-y-auto rounded-none sm:rounded-l-[22px] max-sm:h-auto max-sm:max-h-[92dvh]"
      >
        <div className="pr-12">
          <DialogTitle variant="seva" className="pr-0">
            {title}
          </DialogTitle>
          <DialogDescription className="text-(length:--text-meta) text-(--muted-foreground)">
            {readOnly ? T.viewOnly : T.appliesAfterSave}
          </DialogDescription>
        </div>

        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id={`${id}-code`} label={T.shortCode} hint={T.shortCodeHint} error={problems.code}>
              <input
                id={`${id}-code`}
                className={sevaControlClass}
                value={form.code}
                maxLength={3}
                autoCapitalize="characters"
                disabled={disabled}
                aria-invalid={problems.code !== undefined}
                aria-describedby={`${id}-code-msg`}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
              />
            </Field>
            <Field id={`${id}-key`} label={T.counterKey} hint={T.counterKeyHint} error={problems.key}>
              <input
                id={`${id}-key`}
                className={cn(sevaControlClass, "tabular-nums")}
                inputMode="numeric"
                value={form.key}
                disabled={disabled}
                aria-invalid={problems.key !== undefined}
                aria-describedby={`${id}-key-msg`}
                onChange={(e) => set("key", e.target.value.replace(/[^\d]/g, ""))}
              />
            </Field>
            <Field
              id={`${id}-en`}
              label={T.nameEn}
              error={form.nameEn !== "" || seva ? problems.nameEn : undefined}
              className="sm:col-span-2"
            >
              <input
                id={`${id}-en`}
                className={sevaControlClass}
                value={form.nameEn}
                maxLength={80}
                disabled={disabled}
                aria-invalid={problems.nameEn !== undefined}
                onChange={(e) => set("nameEn", e.target.value)}
              />
            </Field>
            <Field id={`${id}-kn`} label={T.nameKn} error={problems.nameKn} className="sm:col-span-2">
              <input
                id={`${id}-kn`}
                lang="kn"
                className={sevaControlClass}
                value={form.nameKn}
                maxLength={80}
                disabled={disabled}
                onChange={(e) => set("nameKn", e.target.value)}
              />
            </Field>
          </div>

          <SwitchRow
            label={T.anyAmount}
            hint={T.anyAmountHint}
            checked={form.anyAmount}
            disabled={disabled}
            onChange={setAnyAmount}
          />

          {form.anyAmount ? null : (
            <Field
              id={`${id}-rate`}
              label={T.rate}
              error={form.rate !== "" || seva ? problems.rate : undefined}
              hint={changingRate && seva ? (seva.ratePaise === null ? T.wasAnyAmount : T.wasRate(seva.ratePaise)) : undefined}
            >
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="font-semibold text-(--muted-foreground)">
                  {T.rs}
                </span>
                <input
                  id={`${id}-rate`}
                  className={cn(sevaControlClass, "tabular-nums")}
                  inputMode="decimal"
                  value={form.rate}
                  disabled={disabled}
                  aria-invalid={problems.rate !== undefined}
                  aria-describedby={`${id}-rate-msg`}
                  onChange={(e) => set("rate", e.target.value)}
                />
              </div>
            </Field>
          )}

          {changingRate && !readOnly ? (
            <Field id={`${id}-reason`} label={T.reason} error={problems.reason}>
              <textarea
                id={`${id}-reason`}
                className={`${sevaControlClass} h-auto min-h-[88px] py-3`}
                value={form.reason}
                maxLength={200}
                placeholder={T.reasonPlaceholder}
                disabled={disabled}
                aria-invalid={problems.reason !== undefined}
                aria-describedby={`${id}-reason-msg`}
                onChange={(e) => set("reason", e.target.value)}
              />
            </Field>
          ) : null}

          <div className="flex flex-col gap-2">
            <Bilingual en={T.shownOn.en} kn={T.shownOn.kn} className="text-(length:--text-meta) font-semibold" />
            <Segmented<Visibility>
              name={`${id}-shown`}
              label={T.shownOn.en}
              value={visibility}
              onChange={(v) => set("visibility", v)}
              options={(["counter", "online", "both"] as const).map((v) => ({
                value: v,
                en: VISIBILITY_LABEL[v].en,
                kn: VISIBILITY_LABEL[v].kn,
                disabled: disabled || (form.anyAmount && v !== "counter"),
              }))}
            />
          </div>

          <div>
            <SwitchRow
              label={T.multiDate}
              hint={T.multiDateHint}
              checked={form.multiDate}
              disabled={disabled}
              onChange={(v) => set("multiDate", v)}
            />
            <SwitchRow
              label={T.allowAmountChange}
              checked={form.anyAmount ? true : form.allowAmountChange}
              disabled={disabled || form.anyAmount}
              onChange={(v) => set("allowAmountChange", v)}
            />
            <SwitchRow label={T.prasadamGiven} checked={form.prasadamGiven} disabled={disabled} onChange={(v) => set("prasadamGiven", v)} />
            <SwitchRow label={T.active} checked={form.active} disabled={disabled} onChange={(v) => set("active", v)} />
          </div>

          <Field id={`${id}-pr`} label={T.prasadamItems} error={problems.prasadamItems}>
            <input
              id={`${id}-pr`}
              className={sevaControlClass}
              value={form.prasadamItems}
              maxLength={200}
              disabled={disabled}
              onChange={(e) => set("prasadamItems", e.target.value)}
            />
          </Field>

          {error ? (
            <p role="alert" className="text-(--destructive)">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {readOnly ? null : (
              <Button type="submit" variant="seva-primary" disabled={!valid || busy} aria-busy={busy}>
                {busy ? T.saving : seva ? T.saveChanges : T.addTheSeva}
              </Button>
            )}
            <Button type="button" variant="seva-ghost" onClick={onClose}>
              {readOnly ? T.close : T.cancel}
            </Button>
          </div>
        </form>

        {seva ? (
          <>
            <hr className="border-(--border)" />
            <RateHistory sevaId={seva.id} api={api} />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default SevaDrawer;
