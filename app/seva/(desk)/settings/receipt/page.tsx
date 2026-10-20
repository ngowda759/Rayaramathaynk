"use client";

import { useCallback, useEffect, useMemo, useState, type JSX } from "react";

import { PendingButton } from "@/components/seva/motion/PendingButton";
import { HeaderFooterEditor, templatePatch } from "@/components/seva/settings/HeaderFooterEditor";
import { NumberingPreview } from "@/components/seva/settings/NumberingPreview";
import { PaperSizeField } from "@/components/seva/settings/PaperSizeField";
import { errorText, Notice } from "@/components/seva/settings/ReceiptSettingsFields";
import { SlipPreview } from "@/components/seva/settings/SlipPreview";
import { SevaGate } from "@/components/seva/shell/SevaGate";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { useSevaMe } from "@/hooks/seva/useSevaMe";
import { useAuth } from "@/hooks/useAuth";
import type { Bi } from "@/lib/seva/strings/common";
import { RS } from "@/lib/seva/strings/receipt-settings";
import { customPaperProblem } from "@/lib/seva/print/paper";
import { istParts } from "@/lib/seva/time";
import { settingsApi } from "@/services/seva/settings.service";
import type { SlipSettings } from "@/types/seva";

/**
 * Settings - Receipts (DB §13.2; mockup settings-devotee.html#receipt-settings): the receipt number part by part with
 * the four formats, the slip header and footer, and the receipt paper (plan A4S-7), with a live slip preview. Temple admins and super admins edit;
 * view-only temple admins see the same page read-only. Saving sends only the fields that changed, and the office
 * writes an audit row for the change.
 */

type Phase = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; saved: SlipSettings };

function ReceiptSettings(): JSX.Element {
  const { user } = useAuth();
  const { me, can } = useSevaMe();
  const api = useMemo(
    () => settingsApi(() => (user ? user.getIdToken() : Promise.reject(new Error("Sign in again to change settings.")))),
    [user],
  );
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [draft, setDraft] = useState<SlipSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "ok" | "error"; text: Bi | string } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof SlipSettings, string>>>({});
  const [now] = useState(() => new Date());
  const siteUrl = typeof window === "undefined" ? "" : window.location.origin;
  const canEdit = can("settings.edit");
  const ist = istParts(now);

  const load = useCallback(async () => {
    setPhase({ kind: "loading" });
    try {
      const saved = await api.getTemplate();
      setPhase({ kind: "ready", saved });
      setDraft(saved);
    } catch (err) {
      setPhase({ kind: "error", message: errorText(err, RS.loadFailed) });
    }
  }, [api]);

  useEffect(() => {
    // Loading from the API on arrival is the effect's job; the state is set after the call answers.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function save() {
    if (phase.kind !== "ready" || !draft || busy) return;
    const nextErrors: Partial<Record<keyof SlipSettings, string>> = {};
    if (draft.templeNameEn.trim() === "") nextErrors.templeNameEn = RS.nameRequired.en;
    if (draft.templeNameKn.trim() === "") nextErrors.templeNameKn = RS.nameRequired.en;
    if (draft.paperSize === "custom") {
      const problem = customPaperProblem(draft.paperCustomWidthMm ?? Number.NaN, draft.paperCustomHeightMm ?? Number.NaN);
      if (problem === "width") nextErrors.paperCustomWidthMm = RS.paperCustomProblem.width.en;
      if (problem === "height") nextErrors.paperCustomHeightMm = RS.paperCustomProblem.height.en;
      if (problem === "landscape") nextErrors.paperCustomHeightMm = RS.paperCustomProblem.landscape.en;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const patch = templatePatch(phase.saved, draft);
    if (Object.keys(patch).length === 0) {
      setResult({ kind: "ok", text: RS.nothingChanged });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      await api.saveTemplate(patch);
      const saved = { ...phase.saved, ...patch } as SlipSettings;
      setPhase({ kind: "ready", saved });
      setDraft(saved);
      setResult({ kind: "ok", text: RS.saved });
    } catch (err) {
      setResult({ kind: "error", text: errorText(err, RS.loadFailed) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Bilingual as="h2" en={RS.receiptsTitle.en} kn={RS.receiptsTitle.kn} />
          <Bilingual as="div" en={canEdit ? RS.appliesAfterSave.en : RS.viewOnly.en} kn={canEdit ? RS.appliesAfterSave.kn : RS.viewOnly.kn} className="meta" />
        </div>
        {canEdit && phase.kind === "ready" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="seva-ghost"
              disabled={busy}
              onClick={() => {
                setDraft(phase.saved);
                setErrors({});
                setResult(null);
              }}
            >
              {RS.discard.en}
            </Button>
            <PendingButton pending={busy} pendingLabel={RS.saving.en} onClick={() => void save()}>
              {RS.save.en}
            </PendingButton>
          </div>
        ) : null}
      </div>
      {result ? <Notice kind={result.kind} text={result.text} /> : null}

      <NumberingPreview staffNo={me?.staffNo ?? 1} month={ist.month} year={ist.year} counterNo={me?.counter?.id ?? 1} />

      {phase.kind === "loading" ? (
        <div role="status" aria-live="polite" className="p-4">
          <Bilingual en={RS.loading.en} kn={RS.loading.kn} className="text-(--muted-foreground)" />
        </div>
      ) : null}
      {phase.kind === "error" ? (
        <div className="flex flex-col items-start gap-3">
          <Notice kind="error" text={phase.message} />
          <Button type="button" variant="seva-primary" onClick={() => void load()}>
            {RS.tryAgain.en}
          </Button>
        </div>
      ) : null}
      {phase.kind === "ready" && draft ? (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex min-w-0 flex-col gap-5">
            <HeaderFooterEditor
              value={draft}
              onChange={(next) => {
                setDraft(next);
                setResult(null);
              }}
              readOnly={!canEdit}
              errors={errors}
            />
            <PaperSizeField
              value={draft}
              onChange={(next) => {
                setDraft(next);
                setResult(null);
              }}
              readOnly={!canEdit}
              errors={errors}
            />
          </div>
          <div className="min-w-0 xl:sticky xl:top-4">
            <SlipPreview settings={draft} staffNo={me?.staffNo ?? 1} now={now} siteUrl={siteUrl} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ReceiptSettingsPage(): JSX.Element {
  return (
    <SevaGate action="reports.view">
      <ReceiptSettings />
    </SevaGate>
  );
}
