"use client";

import { useEffect, useState, type FormEvent, type JSX } from "react";

import { MotionDialog } from "@/components/seva/motion/MotionDialog";
import { PendingButton } from "@/components/seva/motion/PendingButton";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { STAFF_ROLES, STAFF_TEXT, staffNoText } from "@/lib/seva/strings/staff";
import { staffOnboardSchema } from "@/lib/seva/schemas";
import type { StaffApi } from "@/services/seva/staff.service";
import type { SevaRole } from "@/types/seva";
import type { StaffPartialFailure } from "@/types/seva-staff";
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
  /** The person is onboarded and the email went out; the list reloads and says so. */
  onOnboarded(result: { staffNo: number; fullName: string }): void;
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

function OnboardForm({ onClose, api, sendInvite, can, onOnboarded, onWritten }: OnboardDialogProps): JSX.Element {
  const allowed = Object.fromEntries(STAFF_ROLES.map((r) => [r, onboardRoleAllowed(can, r)])) as Record<SevaRole, boolean>;
  const [staffNo, setStaffNo] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<SevaRole>("receptionist");
  const [viewOnly, setViewOnly] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState<StaffPartialFailure | null>(null);
  const [emailPending, setEmailPending] = useState<EmailPending | null>(null);

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
    if (busy || emailPending) return;
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
    setError(null);
    setPartial(null);
    setBusy(true);
    try {
      const body = parsed.data;
      const result = await api.onboard({
        fullName: body.fullName,
        email: body.email,
        role: body.role,
        viewOnly: body.viewOnly,
        staffNo: body.staffNo,
      });
      onWritten?.();
      await invite({ email: body.email, staffNo: result.staffNo, fullName: body.fullName });
    } catch (err) {
      const failure = partialFailureOf(err);
      if (failure) {
        setPartial(failure);
        onWritten?.();
      } else {
        setError(errorText(err));
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
            disabled={busy || emailPending !== null}
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
            disabled={busy || emailPending !== null}
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
          disabled={busy || emailPending !== null}
        />

        <div className="flex flex-col gap-2">
          <RolePicker name={STAFF_TEXT.role.en} value={role} allowed={allowed} onChange={pickRole} layout="grid" />
          {!allowed.super_admin ? (
            <p className="text-(length:--text-meta) text-(--muted-foreground)">{STAFF_TEXT.superAdminRoleNote}</p>
          ) : null}
        </div>

        <ViewOnlyRow
          checked={role === "temple_admin" && viewOnly}
          disabled={role !== "temple_admin" || busy || emailPending !== null}
          hint={role === "temple_admin" ? STAFF_TEXT.viewOnlyOnboardHint : STAFF_TEXT.viewOnlyTempleAdminsOnly}
          onChange={setViewOnly}
        />

        {error ? (
          <p role="alert" className="rounded-(--radius-control) bg-(--destructive-soft) p-3 text-(--destructive)">
            {error}
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
      </form>
    </>
  );
}

export default OnboardDialog;
