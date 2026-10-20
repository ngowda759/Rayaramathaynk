"use client";

import { useState, type FormEvent, type JSX } from "react";

import { MotionDialog } from "@/components/seva/motion/MotionDialog";
import { PendingButton } from "@/components/seva/motion/PendingButton";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { DialogTitle } from "@/components/ui/dialog";
import { useAsyncAction } from "@/hooks/seva/useAsyncAction";
import type { ListItemSaveRequest } from "@/lib/seva/schemas";
import { LISTS_TEXT as T } from "@/lib/seva/strings/lists";
import { SevaClientError } from "@/services/seva/http";
import type { SevaListItem, SevaListKind } from "@/types/seva";

import { Notice, TextField } from "../ReceiptSettingsFields";

/** What the dialog is open for: a new gotra, or one item of a list. */
export type ListDialogTarget = { mode: "add" } | { mode: "edit"; kind: SevaListKind; item: SevaListItem };

type GotraSave = Extract<ListItemSaveRequest, { kind: "gotra" }>;

export interface ListItemDialogProps {
  open: boolean;
  /** Kept while the dialog animates out after `open` turns false. */
  target: ListDialogTarget | null;
  /** English names of the other gotras, lower case, for the duplicate check before saving. */
  otherGotraNames(exceptId: number | null): ReadonlySet<string>;
  onSave(input: ListItemSaveRequest): Promise<void>;
  onClose(): void;
}

const MAX_NAME = 60;

function fold(text: string): string {
  return text.trim().toLowerCase();
}

function isDuplicate(err: unknown): boolean {
  return err instanceof SevaClientError && err.code === "validation" && err.detail?.reason === "duplicate";
}

function Form({
  target,
  otherGotraNames,
  onSave,
  onClose,
}: Omit<ListItemDialogProps, "open" | "target"> & { target: ListDialogTarget }): JSX.Element {
  const editing = target.mode === "edit" ? target : null;
  const kind: SevaListKind = editing ? editing.kind : "gotra";
  const englishEditable = kind === "gotra";
  const [nameEn, setNameEn] = useState(editing?.item.nameEn ?? "");
  const [nameKn, setNameKn] = useState(editing?.item.nameKn ?? "");
  const [checked, setChecked] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const enTrim = nameEn.trim();
  const knTrim = nameKn.trim();
  // A Kannada name is needed where there was one (nakshatras, rashis and gotras that have one); a new gotra may skip it.
  const kannadaRequired = kind !== "gotra" || (editing?.item.nameKn ?? null) !== null;
  const enError = englishEditable && enTrim === "" ? T.nameNeeded : null;
  const knError = kannadaRequired && knTrim === "" ? T.kannadaNeeded : null;

  const save = useAsyncAction(async (): Promise<void> => {
    setFailure(null);
    setDuplicate(false);
    let input: ListItemSaveRequest;
    if (kind === "gotra") {
      const gotra: GotraSave = editing ? { kind: "gotra", id: editing.item.id, nameEn: enTrim } : { kind: "gotra", nameEn: enTrim };
      if (knTrim !== "") gotra.nameKn = knTrim;
      input = gotra;
    } else {
      const id = editing?.item.id ?? 0;
      input = kind === "nakshatra" ? { kind: "nakshatra", id, nameKn: knTrim } : { kind: "rashi", id, nameKn: knTrim };
    }
    try {
      await onSave(input);
      onClose();
    } catch (err) {
      if (isDuplicate(err)) setDuplicate(true);
      else setFailure(err instanceof SevaClientError ? err.message : T.saveFailed.en);
    }
  });

  function submit(e: FormEvent): void {
    e.preventDefault();
    setChecked(true);
    if (save.pending || enError || knError) return;
    if (englishEditable && otherGotraNames(editing?.item.id ?? null).has(fold(enTrim))) {
      setDuplicate(true);
      return;
    }
    void save.run();
  }

  const title = editing ? T.editTitle(editing.item.nameEn) : T.addTitle;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <DialogTitle variant="seva">
        <Bilingual en={title.en} kn={title.kn} />
      </DialogTitle>
      {englishEditable ? (
        <TextField
          id="list-item-en"
          label={T.englishName}
          value={nameEn}
          onChange={(v) => {
            setNameEn(v);
            setDuplicate(false);
          }}
          maxLength={MAX_NAME}
          error={duplicate ? T.duplicate : checked ? enError : null}
        />
      ) : (
        <p className="m-0 font-semibold">{T.englishFixed(editing?.item.nameEn ?? "")}</p>
      )}
      <TextField
        id="list-item-kn"
        label={T.kannadaName}
        hint={{ en: editing ? T.kannadaHint : T.kannadaHintNew, kn: "" }}
        value={nameKn}
        onChange={setNameKn}
        lang="kn"
        maxLength={MAX_NAME}
        error={checked ? knError : null}
      />
      {failure ? <Notice kind="error" text={failure} /> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="seva-ghost" onClick={onClose} disabled={save.pending}>
          {T.cancel}
        </Button>
        <PendingButton type="submit" pending={save.pending} pendingLabel={T.saving}>
          {T.save}
        </PendingButton>
      </div>
    </form>
  );
}

/**
 * Settings - Devotee lists: the add / edit dialog (plan A4P-5). A gotra gets its English and Kannada names; a
 * nakshatra or rashi only its Kannada spelling, with the English name shown as fixed. Saving a Kannada name marks it
 * checked. The module's MotionDialog springs it in and out and keeps focus inside; Save is a PendingButton.
 */
export function ListItemDialog({ open, target, ...props }: ListItemDialogProps): JSX.Element {
  const key = target ? (target.mode === "add" ? "add" : `${target.kind}-${target.item.id}`) : "none";
  return (
    <MotionDialog open={open && target !== null} onOpenChange={(next) => (next ? undefined : props.onClose())}>
      {target ? <Form key={key} {...props} target={target} /> : null}
    </MotionDialog>
  );
}

export default ListItemDialog;
