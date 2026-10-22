"use client";

import { useEffect, useState, type FormEvent, type JSX } from "react";

import { MotionDialog } from "@/components/seva/motion/MotionDialog";
import { PendingButton } from "@/components/seva/motion/PendingButton";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { mapFirestoreRole } from "@/lib/seva/permissions";
import type { Bi } from "@/lib/seva/strings/common";
import { STAFF_ROLES, STAFF_ROLE_LABEL, STAFF_TEXT, staffNoText } from "@/lib/seva/strings/staff";
import { staffOnboardSchema, type StaffOnboardRequest } from "@/lib/seva/schemas";
import { SevaClientError } from "@/services/seva/http";
import type { StaffApi } from "@/services/seva/staff.service";
import type { SevaRole } from "@/types/seva";
import type { StaffPartialFailure, StaffUnlinkableReason } from "@/types/seva-staff";
import {
  PartialFailureNotice,
  RolePicker,
  ViewOnlyRow,
  errorText,
  partialFailureOf,
  type StaffCan,
} from "./StaffDrawer";

/**
 * Mirrors `onboardStaff` (DB §3.3 rows 18-19): staff.onboard with the new role, and Super admin also needs
 * staff.grant_super_admin. A temple admin therefore gets Receptionist, Prasadam counter and Temple admin.
 */
export function onboardRoleAllowed(can: StaffCan, role: SevaRole): boolean {
  return can("staff.onboard", { newRole: role }) && (role !== "super_admin" || can("staff.grant_super_admin"));
}

export interface OnboardDialogProps {
  open: boolean;
  onClose(): void;
  api: StaffApi;
  /** Asks Firebase to send its own set-password email to the new person (C-56). */
  sendInvite(email: string): Promise<void>;
  can: StaffCan;
  /**
   * The person is onboarded and the email went out, or an existing website account was linked (`linkedExisting`, no
   * email: they keep their password); the list reloads and says so.
   */
  onOnboarded(result: { staffNo: number; fullName: string; linkedExisting?: true }): void;
  /** Something was written (fully or partly): the list reloads. */
  onWritten?(): void;
}

/**
 * Onboard staff (DB §13.6, mockup `onboard-dialog`). The form is rendered only while open, so each opening starts
 * fresh; MotionDialog springs it in and animates it out (plan A4P-4).
 */
export function OnboardDialog(props: OnboardDialogProps): JSX.Element {
  return (
    <MotionDialog
      open={props.open}
      onOpenChange={(open) => (open ? undefined : props.onClose())}
      className="max-h-[92dvh] overflow-y-auto"
    >
      {props.open ? <OnboardForm {...props} /> : null}
    </MotionDialog>
  );
}

type Field = "staffNo" | "fullName" | "email";

interface EmailPending {
  email: string;
  staffNo: number;
  fullName: string;
  message: string;
}

/** The email already has a website account: the office confirms before it is linked (onboardStaff). */
interface ExistingAccount {
  /** Their name on the account, else the email. */
  who: string;
  /** Their current role in words: a seva role's label, else the role as stored, else "none". */
  currentRole: string;
  /** The account is inactive on the website; linking makes it active, so the question says so. */
  inactive: boolean;
  /** The request that was refused; linking resends it with `linkExisting: true`. */
  body: StaffOnboardRequest;
}

/** The server's 400 existing_account answer (StaffExistingAccountDetail), or null for any other error. */
function existingAccountOf(error: unknown, body: StaffOnboardRequest): ExistingAccount | null {
  if (!(error instanceof SevaClientError) || error.code !== "validation" || error.detail?.reason !== "existing_account") {
    return null;
  }
  const { displayName, currentRole, currentlyActive } = error.detail;
  const sevaRole = mapFirestoreRole(currentRole);
  const storedRole = typeof currentRole === "string" ? currentRole.trim() : "";
  return {
    who: typeof displayName === "string" && displayName.trim() !== "" ? displayName.trim() : body.email,
    currentRole: sevaRole ? STAFF_ROLE_LABEL[sevaRole].en : storedRole !== "" ? storedRole : STAFF_TEXT.linkNoRole,
    inactive: currentlyActive === false,
    body,
  };
}

const UNLINKABLE_TEXT: Record<StaffUnlinkableReason, Bi> = {
  unverified_account: STAFF_TEXT.linkUnverified,
  disabled_account: STAFF_TEXT.linkDisabled,
};

/**
 * Why an existing website account cannot be linked here, in English with Kannada under it: never (unverified email,
 * sign-in switched off), or only by a super admin (it holds a website admin role or is inactive). Null for any other
 * error; the shared validation and forbidden messages would not say why.
 */
function unlinkableText(error: unknown): Bi | null {
  if (!(error instanceof SevaClientError)) return null;
  const reason = error.detail?.reason;
  if (error.code === "forbidden" && reason === "needs_super_admin") return STAFF_TEXT.linkNeedsSuperAdmin;
  if (error.code !== "validation") return null;
  return reason === "unverified_account" || reason === "disabled_account" ? UNLINKABLE_TEXT[reason] : null;
}

function OnboardForm({ onClose, api, sendInvite, can, onOnboarded, onWritten }: OnboardDialogProps): JSX.Element {
  const allowed = Object.fromEntries(STAFF_ROLES.map((r) => [r, onboardRoleAllowed(can, r)])) as Record<SevaRole, boolean>;
  const [staffNo, setStaffNo] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<SevaRole>("receptionist");
  const [viewOnly, setViewOnly] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | Bi | null>(null);
  const [partial, setPartial] = useState<StaffPartialFailure | null>(null);
  const [emailPending, setEmailPending] = useState<EmailPending | null>(null);
  const [existing, setExisting] = useState<ExistingAccount | null>(null);
  const locked = busy || emailPending !== null || existing !== null;

  useEffect(() => {
    let live = true;
    api
      .nextStaffNo()
      .then((no) => {
        if (live) setStaffNo((current) => (current === "" ? String(no) : current));
      })
      .catch((err: unknown) => {
        if (live) setError(errorText(err));
      });
    return () => {
      live = false;
    };
  }, [api]);

  function pickRole(next: SevaRole): void {
    // The question names the role; a new role means asking again with it.
    setExisting(null);
    setRole(next);
    if (next !== "temple_admin") setViewOnly(false);
  }

  async function invite(target: { email: string; staffNo: number; fullName: string }): Promise<void> {
    try {
      await sendInvite(target.email);
      setEmailPending(null);
      onOnboarded({ staffNo: target.staffNo, fullName: target.fullName });
      onClose();
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "";
      setEmailPending({ ...target, message });
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (locked) return;
    const no = staffNo.trim() === "" ? Number.NaN : Number(staffNo);
    const parsed = staffOnboardSchema.safeParse({ fullName, email, role, viewOnly: role === "temple_admin" && viewOnly, staffNo: no });
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "staffNo") next.staffNo ??= STAFF_TEXT.needStaffNo;
        if (field === "fullName") next.fullName ??= STAFF_TEXT.needName;
        if (field === "email") next.email ??= STAFF_TEXT.needEmail;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    const body = parsed.data;
    await send({
      fullName: body.fullName,
      email: body.email,
      role: body.role,
      viewOnly: body.viewOnly,
      staffNo: body.staffNo,
    });
  }

  /** Onboards (or, with `linkExisting`, links); a new login then gets the set-password email, a linked one does not. */
  async function send(body: StaffOnboardRequest): Promise<void> {
    setError(null);
    setPartial(null);
    setBusy(true);
    try {
      const result = await api.onboard(body);
      setExisting(null);
      onWritten?.();
      if (result.linkedExisting) {
        // They keep their own password, so no set-password email (C-56 is for new logins only).
        onOnboarded({ staffNo: result.staffNo, fullName: body.fullName, linkedExisting: true });
        onClose();
        return;
      }
      await invite({ email: body.email, staffNo: result.staffNo, fullName: body.fullName });
    } catch (err) {
      const found = body.linkExisting ? null : existingAccountOf(err, body);
      setExisting(found);
      if (found) return;
      const failure = partialFailureOf(err);
      if (failure) {
        setPartial(failure);
        onWritten?.();
      } else {
        setError(unlinkableText(err) ?? errorText(err));
      }
    } finally {
      setBusy(false);
    }
  }

  const shownNo = Number.isInteger(Number(staffNo)) && staffNo.trim() !== "" ? staffNoText(Number(staffNo)) : "";

  return (
    <>
      <div className="flex items-start justify-between gap-3 pr-12">
        <DialogTitle variant="seva" className="pr-0">
          <Bilingual en={STAFF_TEXT.onboardTitle.en} kn={STAFF_TEXT.onboardTitle.kn} />
        </DialogTitle>
        {shownNo ? (
          <span className="rounded-full bg-(--secondary) px-3 py-1 text-(length:--text-meta) font-semibold tabular-nums">
            {STAFF_TEXT.staffNo} {shownNo}
          </span>
        ) : null}
      </div>
      <DialogDescription className="text-(length:--text-meta) text-(--muted-foreground)">
        {STAFF_TEXT.signInLine}
      </DialogDescription>

      <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
          <Input
            variant="seva"
            label={STAFF_TEXT.staffNo}
            inputMode="numeric"
            type="number"
            min={1}
            max={999}
            value={staffNo}
            error={errors.staffNo}
            onChange={(e) => setStaffNo(e.target.value)}
            disabled={locked}
          />
          <Input
            variant="seva"
            label={STAFF_TEXT.fullName}
            autoComplete="off"
            placeholder={STAFF_TEXT.fullNamePlaceholder}
            maxLength={80}
            value={fullName}
            error={errors.fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={locked}
          />
        </div>
        <p className="-mt-3 text-(length:--text-meta) text-(--muted-foreground)">{STAFF_TEXT.staffNoHint}</p>
        <Input
          variant="seva"
          label={STAFF_TEXT.email}
          type="email"
          autoComplete="off"
          placeholder={STAFF_TEXT.emailPlaceholder}
          value={email}
          error={errors.email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={locked}
        />

        <div className="flex flex-col gap-2">
          <RolePicker name={STAFF_TEXT.role.en} value={role} allowed={allowed} onChange={pickRole} layout="grid" />
          {!allowed.super_admin ? (
            <p className="text-(length:--text-meta) text-(--muted-foreground)">{STAFF_TEXT.superAdminRoleNote}</p>
          ) : null}
        </div>

        <ViewOnlyRow
          checked={role === "temple_admin" && viewOnly}
          disabled={role !== "temple_admin" || locked}
          hint={role === "temple_admin" ? STAFF_TEXT.viewOnlyOnboardHint : STAFF_TEXT.viewOnlyTempleAdminsOnly}
          onChange={setViewOnly}
        />

        {error ? (
          <p role="alert" className="rounded-(--radius-control) bg-(--destructive-soft) p-3 text-(--destructive)">
            {typeof error === "string" ? error : <Bilingual en={error.en} kn={error.kn} />}
          </p>
        ) : null}
        {partial ? <PartialFailureNotice done={partial.done} failed={partial.failed} partly={partial.partly} /> : null}
        {emailPending ? (
          <PartialFailureNotice
            lead={STAFF_TEXT.emailNotSent(staffNoText(emailPending.staffNo))}
            done={["identity", "staff"]}
            failed="email"
          >
            {emailPending.message ? (
              <p className="text-(length:--text-meta) text-(--muted-foreground)">{emailPending.message}</p>
            ) : null}
            <div>
              <PendingButton
                variant="seva-secondary"
                size="sm"
                pending={busy}
                pendingLabel={STAFF_TEXT.sending}
                onClick={() => {
                  setBusy(true);
                  void invite(emailPending).finally(() => setBusy(false));
                }}
              >
                {STAFF_TEXT.sendEmailAgain}
              </PendingButton>
            </div>
          </PartialFailureNotice>
        ) : null}
        {existing ? (
          <ExistingAccountConfirm
            existing={existing}
            newRole={STAFF_ROLE_LABEL[existing.body.role].en}
            busy={busy}
            onLink={() => void send({ ...existing.body, linkExisting: true })}
            onCancel={() => setExisting(null)}
          />
        ) : (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="seva-ghost" onClick={onClose} disabled={busy}>
              {emailPending ? STAFF_TEXT.close : STAFF_TEXT.cancel}
            </Button>
            {emailPending ? null : (
              <PendingButton type="submit" pending={busy} pendingLabel={STAFF_TEXT.sending}>
                {STAFF_TEXT.sendInvite}
              </PendingButton>
            )}
          </div>
        )}
      </form>
    </>
  );
}

interface ExistingAccountConfirmProps {
  existing: ExistingAccount;
  newRole: string;
  busy: boolean;
  onLink(): void;
  onCancel(): void;
}

/** "<name> already has a website account ... Link this account?" - Cancel goes back to the form to change the email. */
function ExistingAccountConfirm({ existing, newRole, busy, onLink, onCancel }: ExistingAccountConfirmProps): JSX.Element {
  const question = STAFF_TEXT.linkQuestion(existing.who, existing.currentRole, newRole);
  return (
    <section
      aria-label={STAFF_TEXT.linkTitle.en}
      className="flex flex-col gap-3 rounded-(--radius-control) border border-(--border) bg-(--attn-soft) p-4"
    >
      <Bilingual as="h3" className="font-semibold" en={STAFF_TEXT.linkTitle.en} kn={STAFF_TEXT.linkTitle.kn} />
      <Bilingual as="div" en={question.en} kn={question.kn} />
      {existing.inactive ? (
        <Bilingual as="div" className="font-semibold" en={STAFF_TEXT.linkInactive.en} kn={STAFF_TEXT.linkInactive.kn} />
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="seva-ghost" onClick={onCancel} disabled={busy}>
          {STAFF_TEXT.linkCancel.en}
        </Button>
        <PendingButton type="button" pending={busy} pendingLabel={STAFF_TEXT.linking} onClick={onLink}>
          {STAFF_TEXT.linkConfirm.en}
        </PendingButton>
      </div>
    </section>
  );
}

export default OnboardDialog;
