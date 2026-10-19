"use client";

import { useId, useState, type JSX, type ReactNode } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import type { PermissionContext } from "@/lib/seva/permissions";
import {
  STAFF_ROLE_HINT,
  STAFF_ROLE_LABEL,
  STAFF_ROLES,
  STAFF_STATUS_LABEL,
  STAFF_STEP_LABEL,
  STAFF_TEXT,
  STAFF_WRITE_LABEL,
  staffNoText,
  type StaffStepName,
} from "@/lib/seva/strings/staff";
import { cn } from "@/lib/utils";
import { SevaClientError } from "@/services/seva/http";
import type { StaffApi } from "@/services/seva/staff.service";
import type { SevaAction, SevaRole } from "@/types/seva";
import type { StaffMember, StaffPartialFailure, StaffStatus } from "@/types/seva-staff";

/** `useSevaMe().can`: the permission matrix for the signed-in person (it only hides; the server checks again). */
export type StaffCan = (action: SevaAction, ctx?: PermissionContext) => boolean;

/** What the signed-in person may do to one staff member, exactly as lib/seva/server/staff.ts `updateStaff` judges it. */
export interface StaffRights {
  /** The person is the signed-in one: nobody changes their own role, view-only switch or status. */
  self: boolean;
  /** Which roles may be chosen in the drawer (the current role counts when any change is allowed). */
  roles: Record<SevaRole, boolean>;
  /** The view-only switch may be changed (it applies only while the resulting role is temple admin). */
  viewOnly: boolean;
  reactivate: boolean;
  offboard: boolean;
  remove: boolean;
}

const NO_ROLES: Record<SevaRole, boolean> = {
  receptionist: false,
  prasadam_counter: false,
  temple_admin: false,
  super_admin: false,
};

/**
 * Mirrors `updateStaff` (DB §3.3 rows 19-23, C-17, A3 security gate M-1):
 * - nothing for oneself or for a deleted person (deleted stays deleted, DB §3.4);
 * - a role change needs staff.change_role with the person's current role, their id and the new role, and Super admin
 *   also needs staff.grant_super_admin;
 * - the view-only switch needs staff.change_role with the current role and id;
 * - Reactivate (an inactive person) needs staff.reactivate, and staff.grant_super_admin when the person is a super
 *   admin, because reactivating gives super admin access back;
 * - Offboard (an active or invited person) needs staff.deactivate; Delete needs staff.delete.
 */
export function staffRights(can: StaffCan, meStaffId: string, target: StaffMember): StaffRights {
  const self = target.id === meStaffId;
  if (self || target.status === "deleted") {
    return { self, roles: { ...NO_ROLES }, viewOnly: false, reactivate: false, offboard: false, remove: false };
  }
  const base: PermissionContext = { targetRole: target.role ?? undefined, targetStaffId: target.id };
  const grantSuper = can("staff.grant_super_admin");
  const editAtAll = can("staff.change_role", base);
  const roles = { ...NO_ROLES };
  for (const role of STAFF_ROLES) {
    roles[role] =
      role === target.role
        ? editAtAll
        : can("staff.change_role", { ...base, newRole: role }) && (role !== "super_admin" || grantSuper);
  }
  return {
    self,
    roles,
    viewOnly: editAtAll,
    reactivate:
      target.status === "inactive" && can("staff.reactivate") && (target.role !== "super_admin" || grantSuper),
    offboard: (target.status === "active" || target.status === "invited") && can("staff.deactivate"),
    remove: can("staff.delete"),
  };
}

/** True when the drawer has anything the person may do. */
export function hasAnyRight(rights: StaffRights): boolean {
  return (
    Object.values(rights.roles).some(Boolean) || rights.viewOnly || rights.reactivate || rights.offboard || rights.remove
  );
}

/* ---------- shared pieces (the onboard dialog uses them too) ---------- */

export interface RolePickerProps {
  /** Accessible name of the group. */
  name: string;
  value: SevaRole | null;
  allowed: Record<SevaRole, boolean>;
  onChange(role: SevaRole): void;
  /** Show what each role does under its name (the drawer does; the dialog keeps it short). */
  withHints?: boolean;
  layout?: "list" | "grid";
}

/** The four roles as native radios styled as cards, so arrow keys and screen readers work as for any radio group. */
export function RolePicker({ name, value, allowed, onChange, withHints = false, layout = "list" }: RolePickerProps): JSX.Element {
  const groupId = useId();
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-(length:--text-meta) font-semibold text-(--foreground)">
        <Bilingual en={STAFF_TEXT.role.en} kn={STAFF_TEXT.role.kn} />
      </legend>
      <div role="radiogroup" aria-label={name} className={cn("grid gap-2", layout === "grid" && "sm:grid-cols-2")}>
        {STAFF_ROLES.map((role) => {
          const id = `${groupId}-${role}`;
          const disabled = !allowed[role];
          return (
            <label
              key={role}
              htmlFor={id}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 rounded-[14px] border border-(--border-strong) bg-(--card) px-4 py-3 text-left",
                "has-[:checked]:border-(--primary-press) has-[:checked]:bg-(--primary-soft) has-[:checked]:shadow-[0_0_0_1px_var(--primary-press)]",
                "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color-mix(in_oklab,var(--focus)_55%,transparent)]",
                disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer hover:bg-(--secondary)",
              )}
            >
              <input
                id={id}
                type="radio"
                name={groupId}
                value={role}
                checked={value === role}
                disabled={disabled}
                onChange={() => onChange(role)}
                className="sr-only"
              />
              <Bilingual en={STAFF_ROLE_LABEL[role].en} kn={STAFF_ROLE_LABEL[role].kn} className="font-semibold" />
              {withHints ? (
                <span className="text-(length:--text-meta) text-(--muted-foreground)">{STAFF_ROLE_HINT[role]}</span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export interface ViewOnlyRowProps {
  checked: boolean;
  disabled: boolean;
  hint: string;
  onChange(checked: boolean): void;
}

export function ViewOnlyRow({ checked, disabled, hint, onChange }: ViewOnlyRowProps): JSX.Element {
  const hintId = useId();
  return (
    <div className="flex items-start justify-between gap-4 border-t border-(--border) pt-4">
      <div className="min-w-0">
        <Bilingual as="div" en={STAFF_TEXT.viewOnly.en} kn={STAFF_TEXT.viewOnly.kn} className="font-semibold" />
        <p id={hintId} className="text-(length:--text-meta) text-(--muted-foreground)">
          {hint}
        </p>
      </div>
      <Switch
        variant="seva"
        aria-label={STAFF_TEXT.viewOnly.en}
        aria-describedby={hintId}
        aria-disabled={disabled}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onChange(next)}
      />
    </div>
  );
}

function stepLabel(step: string): string {
  return Object.prototype.hasOwnProperty.call(STAFF_STEP_LABEL, step) ? STAFF_STEP_LABEL[step as StaffStepName] : step;
}

/** Reads `error.detail` of a 502 partial_failure; null for anything else. */
export function partialFailureOf(error: unknown): StaffPartialFailure | null {
  if (!(error instanceof SevaClientError) || error.code !== "partial_failure" || !error.detail) return null;
  const { done, failed, partly, cause } = error.detail;
  if (!Array.isArray(done) || typeof failed !== "string") return null;
  return {
    done: done.filter((s): s is StaffPartialFailure["failed"] => typeof s === "string") as StaffPartialFailure["done"],
    failed: failed as StaffPartialFailure["failed"],
    ...(Array.isArray(partly) ? { partly: partly.filter((s): s is string => typeof s === "string") } : {}),
    ...(typeof cause === "string" ? { cause } : {}),
  };
}

export interface PartialFailureNoticeProps {
  /** The steps that went through and the one that failed (server steps, or the set-password email). */
  done: readonly string[];
  failed: string;
  partly?: readonly string[];
  /** A first line before the steps, e.g. "Staff no. 035 is onboarded, but ..." */
  lead?: string;
  children?: ReactNode;
}

/** DB §3.2: a change that went only part of the way is never silent - it says what was done and where it stopped. */
export function PartialFailureNotice({ done, failed, partly, lead, children }: PartialFailureNoticeProps): JSX.Element {
  const partlyText =
    partly && partly.length > 0
      ? ` (${STAFF_TEXT.partialPartly(partly.map((w) => STAFF_WRITE_LABEL[w] ?? w).join(" and "))})`
      : "";
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-(--radius-control) border border-[color-mix(in_oklab,var(--destructive)_35%,transparent)] bg-(--destructive-soft) p-4 text-(length:--text-ui)"
    >
      <strong className="text-(--destructive)">{lead ?? STAFF_TEXT.partialTitle}</strong>
      <p>
        {STAFF_TEXT.partialDone}: {done.length > 0 ? done.map(stepLabel).join(", ") : STAFF_TEXT.partialNothingDone}
      </p>
      <p>
        {STAFF_TEXT.partialFailed}: {stepLabel(failed)}
        {partlyText}
      </p>
      <p className="text-(length:--text-meta) text-(--muted-foreground)">{STAFF_TEXT.partialHint}</p>
      {children}
    </div>
  );
}

/** A plain message for a refused or failed call. */
export function errorText(error: unknown): string {
  if (error instanceof SevaClientError) return error.message;
  return STAFF_TEXT.loadFailed;
}

export function initials(name: string): string {
  const words = name
    .replace(/^(mr|mrs|ms|dr|sri|smt)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

const STATUS_TONE: Record<StaffStatus, string> = {
  active: "bg-(--ok-soft) text-(--ok)",
  invited: "bg-(--attn-soft) text-(--foreground)",
  inactive: "bg-(--secondary) text-(--muted-foreground)",
  deleted: "bg-(--destructive-soft) text-(--destructive)",
};

export function StatusBadge({ status }: { status: StaffStatus }): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-(length:--text-meta) font-semibold whitespace-nowrap",
        STATUS_TONE[status],
      )}
    >
      {STAFF_STATUS_LABEL[status].en}
    </span>
  );
}

export function ViewOnlyBadge(): JSX.Element {
  return (
    <span className="inline-flex items-center rounded-full border border-(--border-strong) bg-(--attn-soft) px-2.5 py-0.5 text-(length:--text-meta) font-semibold whitespace-nowrap">
      {STAFF_TEXT.viewOnly.en}
    </span>
  );
}

/* ---------- the drawer ---------- */

export interface StaffNotice {
  title: string;
  hint?: string;
}

export interface StaffDrawerProps {
  /** The person shown; null closes the drawer. */
  member: StaffMember | null;
  meStaffId: string;
  can: StaffCan;
  api: StaffApi;
  onClose(): void;
  /** A change went through (fully or partly): the list reloads and shows the notice. */
  onChanged(notice: StaffNotice | null): void;
}

type Pending = null | "offboard" | "remove";

const REASON_MIN = 3;

function reasonOk(reason: string): boolean {
  return Array.from(reason.trim()).length >= REASON_MIN;
}

/**
 * One person (DB §13.6, mockup `staff-drawer`): role, view-only, Reactivate, and for super admins "Offboard
 * (deactivate)" and "Delete user", each with a reason. The Active switch of the mockup and Offboard do the same thing,
 * so only Offboard is shown (C-09). Only what the server would accept is offered (`staffRights`).
 */
export function StaffDrawer({ member, ...rest }: StaffDrawerProps): JSX.Element | null {
  if (!member) return null;
  // Keyed so that opening another person starts from that person's values.
  return <DrawerBody key={member.id} member={member} {...rest} />;
}

function DrawerBody({ member, meStaffId, can, api, onClose, onChanged }: StaffDrawerProps & { member: StaffMember }): JSX.Element {
  const rights = staffRights(can, meStaffId, member);
  const [role, setRole] = useState<SevaRole | null>(member.role);
  const [viewOnly, setViewOnly] = useState(member.viewOnly);
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState<StaffPartialFailure | null>(null);
  const offId = useId();
  const delId = useId();

  const resultingRole = role;
  const viewOnlyApplies = resultingRole === "temple_admin";
  const viewOnlyValue = viewOnlyApplies && viewOnly;
  const roleChanged = role !== null && role !== member.role;
  const viewOnlyChanged = viewOnlyApplies && viewOnly !== member.viewOnly;
  const anyRoleRight = Object.values(rights.roles).some(Boolean);
  const staffNo = staffNoText(member.staffNo);

  async function run(body: Parameters<StaffApi["update"]>[1], notice: StaffNotice): Promise<void> {
    setBusy(true);
    setError(null);
    setPartial(null);
    try {
      await api.update(member.id, body);
      onChanged(notice);
      onClose();
    } catch (err) {
      const failure = partialFailureOf(err);
      if (failure) {
        setPartial(failure);
        onChanged(null);
      } else {
        setError(errorText(err));
      }
    } finally {
      setBusy(false);
    }
  }

  function save(): void {
    const body: { role?: SevaRole; viewOnly?: boolean } = {};
    if (roleChanged && role) body.role = role;
    if (viewOnlyChanged) body.viewOnly = viewOnly;
    void run(body, { title: STAFF_TEXT.saved(member.fullName) });
  }

  function choose(next: Pending): void {
    setPending(next);
    setReason("");
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent
        variant="seva"
        className="top-0 right-0 left-auto flex h-dvh max-h-dvh w-[min(480px,100%)] translate-x-0 translate-y-0 flex-col gap-5 overflow-y-auto rounded-none sm:rounded-l-[22px] max-sm:h-auto max-sm:max-h-[92dvh]"
      >
        <div className="flex items-start gap-4 pr-12">
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-(--primary-soft) text-(length:--text-meta) font-semibold"
          >
            {initials(member.fullName)}
          </span>
          <div className="min-w-0">
            <DialogTitle variant="seva" className="pr-0">
              {member.fullName}
            </DialogTitle>
            <DialogDescription className="text-(length:--text-meta) text-(--muted-foreground)">
              {STAFF_TEXT.staffNoLine(staffNo, member.email)}
            </DialogDescription>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={member.status} />
              {member.viewOnly && member.role === "temple_admin" ? <ViewOnlyBadge /> : null}
            </div>
          </div>
        </div>

        {rights.self ? <p className="text-(--muted-foreground)">{STAFF_TEXT.selfNote}</p> : null}
        {member.status === "deleted" ? <p className="text-(--muted-foreground)">{STAFF_TEXT.deletedNote}</p> : null}

        {!rights.self && member.status !== "deleted" ? (
          <>
            <div className="flex flex-col gap-2">
              <RolePicker name={STAFF_TEXT.role.en} value={role} allowed={rights.roles} onChange={setRole} withHints />
              {!can("staff.grant_super_admin") && anyRoleRight ? (
                <p className="text-(length:--text-meta) text-(--muted-foreground)">{STAFF_TEXT.superAdminRoleNote}</p>
              ) : null}
              {!anyRoleRight ? (
                <p className="text-(length:--text-meta) text-(--muted-foreground)">{STAFF_TEXT.roleReadOnly}</p>
              ) : null}
            </div>

            <ViewOnlyRow
              checked={viewOnlyValue}
              disabled={!rights.viewOnly || !viewOnlyApplies || busy}
              hint={viewOnlyApplies ? STAFF_TEXT.viewOnlyDrawerHint : STAFF_TEXT.viewOnlyTempleAdminsOnly}
              onChange={setViewOnly}
            />

            {anyRoleRight || rights.viewOnly ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="seva-primary" disabled={busy || (!roleChanged && !viewOnlyChanged)} aria-busy={busy} onClick={save}>
                  {busy ? STAFF_TEXT.saving : STAFF_TEXT.save}
                </Button>
                <Button variant="seva-ghost" onClick={onClose} disabled={busy}>
                  {STAFF_TEXT.cancel}
                </Button>
              </div>
            ) : null}

            <StatusSection
              member={member}
              rights={rights}
              reactivateNeedsSuper={
                member.status === "inactive" && member.role === "super_admin" && can("staff.reactivate") && !rights.reactivate
              }
              busy={busy}
              onReactivate={() =>
                void run(
                  { status: "active" },
                  { title: STAFF_TEXT.reactivated(member.fullName), hint: STAFF_TEXT.reactivatedHint(staffNo) },
                )
              }
            />
          </>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-(--radius-control) bg-(--destructive-soft) p-3 text-(--destructive)">
            {error}
          </p>
        ) : null}
        {partial ? <PartialFailureNotice done={partial.done} failed={partial.failed} partly={partial.partly} /> : null}

        {rights.offboard || rights.remove ? (
          <section
            aria-labelledby={`${offId}-title`}
            className="flex flex-col gap-4 rounded-2xl border border-[color-mix(in_oklab,var(--destructive)_28%,transparent)] p-5"
          >
            <div>
              <h3 id={`${offId}-title`} className="font-semibold">
                {STAFF_TEXT.superActionsTitle}
              </h3>
              <p className="text-(length:--text-meta) text-(--muted-foreground)">{STAFF_TEXT.superActionsHint}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {rights.offboard ? (
                <Button variant="seva-secondary" size="sm" aria-expanded={pending === "offboard"} onClick={() => choose("offboard")}>
                  {STAFF_TEXT.offboard}
                </Button>
              ) : null}
              {rights.remove && pending !== "remove" ? (
                <Button variant="seva-secondary" size="sm" aria-expanded={false} onClick={() => choose("remove")}>
                  {STAFF_TEXT.remove}
                </Button>
              ) : null}
            </div>

            {pending === "offboard" ? (
              <div role="group" aria-label={STAFF_TEXT.offboard} className="flex flex-col gap-3">
                <ReasonField
                  id={offId}
                  label={STAFF_TEXT.offboardReason(member.fullName)}
                  placeholder={STAFF_TEXT.offboardPlaceholder}
                  hint={STAFF_TEXT.offboardHint(staffNo)}
                  value={reason}
                  onChange={setReason}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="seva-danger"
                    size="sm"
                    disabled={busy || !reasonOk(reason)}
                    aria-busy={busy}
                    onClick={() =>
                      void run({ status: "inactive", reason: reason.trim() }, { title: STAFF_TEXT.offboarded(member.fullName) })
                    }
                  >
                    {STAFF_TEXT.offboardConfirm(member.fullName)}
                  </Button>
                  <Button variant="seva-ghost" size="sm" onClick={() => choose(null)} disabled={busy}>
                    {STAFF_TEXT.cancel}
                  </Button>
                </div>
              </div>
            ) : null}

            {pending === "remove" ? (
              <div role="group" aria-label={STAFF_TEXT.remove} className="flex flex-col gap-3">
                <div role="note" className="rounded-(--radius-control) bg-(--destructive-soft) p-3">
                  <strong>{STAFF_TEXT.removeWarnTitle}</strong>
                  <p className="text-(length:--text-meta)">{STAFF_TEXT.removeWarn}</p>
                </div>
                <ReasonField
                  id={delId}
                  label={STAFF_TEXT.removeReason}
                  placeholder={STAFF_TEXT.removePlaceholder}
                  value={reason}
                  onChange={setReason}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="seva-danger"
                    size="sm"
                    disabled={busy || !reasonOk(reason)}
                    aria-busy={busy}
                    onClick={() =>
                      void run({ status: "deleted", reason: reason.trim() }, { title: STAFF_TEXT.removed(member.fullName) })
                    }
                  >
                    {STAFF_TEXT.removeConfirm}
                  </Button>
                  <Button variant="seva-ghost" size="sm" onClick={() => choose(null)} disabled={busy}>
                    {STAFF_TEXT.cancel}
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        ) : !rights.self && member.status !== "deleted" ? (
          <p className="text-(length:--text-meta) text-(--muted-foreground)">{STAFF_TEXT.superActionsByOthers}</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function StatusSection({
  member,
  rights,
  reactivateNeedsSuper,
  busy,
  onReactivate,
}: {
  member: StaffMember;
  rights: StaffRights;
  /** Allowed to reactivate others, but this person is a super admin (needs staff.grant_super_admin). */
  reactivateNeedsSuper: boolean;
  busy: boolean;
  onReactivate(): void;
}): JSX.Element | null {
  if (member.status === "invited") {
    return <p className="text-(length:--text-meta) text-(--muted-foreground)">{STAFF_TEXT.invitedNote}</p>;
  }
  if (member.status !== "inactive") return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--border) pt-4">
      <p className="text-(--muted-foreground)">{STAFF_TEXT.inactiveNote}</p>
      {rights.reactivate ? (
        <Button variant="seva-secondary" size="sm" disabled={busy} aria-busy={busy} onClick={onReactivate}>
          {STAFF_TEXT.reactivate.en}
        </Button>
      ) : reactivateNeedsSuper ? (
        <p className="text-(length:--text-meta) text-(--muted-foreground)">{STAFF_TEXT.reactivateSuperAdminNote}</p>
      ) : null}
    </div>
  );
}

function ReasonField({
  id,
  label,
  placeholder,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  hint?: string;
  value: string;
  onChange(value: string): void;
}): JSX.Element {
  const short = value.trim() !== "" && !reasonOk(value);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-(length:--text-meta) font-semibold">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        maxLength={200}
        rows={3}
        placeholder={placeholder}
        aria-invalid={short}
        aria-describedby={hint || short ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-(--radius-control) border border-(--border-strong) bg-(--input) px-4 py-3 text-(length:--text-body) focus:border-(--primary-press) focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_30%,transparent)] focus:outline-none aria-invalid:border-(--destructive)"
      />
      {hint || short ? (
        <span id={`${id}-hint`} className={cn("text-(length:--text-meta)", short ? "text-(--destructive)" : "text-(--muted-foreground)")}>
          {short ? STAFF_TEXT.reasonMin : hint}
        </span>
      ) : null}
    </div>
  );
}

export default StaffDrawer;
