"use client";

import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import { m } from "framer-motion";

import { PendingButton } from "@/components/seva/motion/PendingButton";
import { Reveal } from "@/components/seva/motion/Reveal";
import { SevaMotion } from "@/components/seva/motion/SevaMotion";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Segmented } from "@/components/seva/ui/Segmented";
import { Button } from "@/components/ui/button";
import { sevaControlClass } from "@/components/ui/input";
import { sevaErrorMessage } from "@/lib/seva/errors";
import { enterVariants, staggerChildren } from "@/lib/seva/motion";
import { IST } from "@/lib/seva/time";
import { STAFF_ROLE_LABEL, STAFF_TEXT, staffNoText } from "@/lib/seva/strings/staff";
import { cn } from "@/lib/utils";
import type { StaffApi } from "@/services/seva/staff.service";
import type { SevaMe } from "@/types/seva";
import type { StaffListFilter, StaffMember, StaffPartialFailure, StaffStatus } from "@/types/seva-staff";
import { OnboardDialog } from "./OnboardDialog";
import {
  PartialFailureNotice,
  StaffDrawer,
  StatusBadge,
  ViewOnlyBadge,
  errorText,
  hasAnyRight,
  partialFailureOf,
  staffRights,
  type StaffCan,
  type StaffNotice,
} from "./StaffDrawer";

/** The list filter, as the server reads it: Active = active and invited; Inactive = inactive and deleted. */
const FILTER_STATUSES: Record<StaffListFilter, readonly StaffStatus[] | null> = {
  all: null,
  active: ["active", "invited"],
  inactive: ["inactive", "deleted"],
};

function inFilter(member: StaffMember, filter: StaffListFilter): boolean {
  const statuses = FILTER_STATUSES[filter];
  return statuses === null || statuses.includes(member.status);
}

const WHEN = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const DAY = new Intl.DateTimeFormat("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });

/** 'Sat 17 Oct, 19:40' in IST. */
export function formatWhen(iso: string): string {
  const parts = WHEN.formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")}, ${get("hour")}:${get("minute")}`;
}

function formatDay(iso: string): string {
  const parts = DAY.formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")}`;
}

function lastActiveText(member: StaffMember): string {
  if (member.status === "invited" && member.firstSignedInAt === null) {
    return STAFF_TEXT.invitedNotSignedIn(member.invitedAt ? formatDay(member.invitedAt) : "");
  }
  return member.lastActiveAt ? formatWhen(member.lastActiveAt) : STAFF_TEXT.never;
}

function matches(member: StaffMember, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (q === "") return true;
  const digits = q.replace(/^0+/, "");
  return (
    member.fullName.toLowerCase().includes(q) ||
    member.email.toLowerCase().includes(q) ||
    staffNoText(member.staffNo).includes(q) ||
    (digits !== "" && String(member.staffNo) === digits)
  );
}

export interface StaffListProps {
  api: StaffApi;
  /** Asks Firebase to send its own set-password email (C-56). */
  sendInvite(email: string): Promise<void>;
  me: SevaMe;
  can: StaffCan;
  /** Open the onboard dialog on arrival (/admin/users/new sends people here). */
  startOnboarding?: boolean;
}

/**
 * Staff and roles (DB §13.6, mockup `settings-devotee.html#staff`): everyone with a staff number, their role, the
 * view-only badge, status and last activity; All / Active / Inactive; Onboard staff; a drawer per person. The page
 * offers only what the server would accept (`staffRights`, `onboardRoleAllowed`); the server checks every change.
 *
 * /admin/users sits outside the seva layouts, so the list brings its own SevaMotion: the rows, the notice, the drawer
 * and the onboard dialog (portals keep the context) spring with the Lively spring and honour prefers-reduced-motion.
 */
export function StaffList({ api, sendInvite, me, can, startOnboarding = false }: StaffListProps): JSX.Element {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StaffListFilter>("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState(startOnboarding);
  const [notice, setNotice] = useState<StaffNotice | null>(null);
  const [rowError, setRowError] = useState<{ id: string; text: string } | null>(null);
  const [rowPartial, setRowPartial] = useState<{ name: string; failure: StaffPartialFailure } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** The first rows have staggered in; rows that mount after that do not animate. */
  const [arrived, setArrived] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoadError(null);
    try {
      setStaff(await api.list("all"));
    } catch (err) {
      setLoadError(errorText(err));
    }
  }, [api]);

  useEffect(() => {
    // Loading the list from the API on arrival is the effect's job; the state is set after the call answers.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const all = staff ?? [];
    return {
      all: all.length,
      active: all.filter((m) => inFilter(m, "active")).length,
      inactive: all.filter((m) => inFilter(m, "inactive")).length,
    };
  }, [staff]);

  const shown = useMemo(
    () => (staff ?? []).filter((m) => inFilter(m, filter) && matches(m, search)),
    [staff, filter, search],
  );
  const openMember = staff?.find((m) => m.id === openId) ?? null;

  function changed(next: StaffNotice | null): void {
    if (next) setNotice(next);
    void load();
  }

  async function reactivate(member: StaffMember): Promise<void> {
    setBusyId(member.id);
    setRowError(null);
    setRowPartial(null);
    try {
      await api.update(member.id, { status: "active" });
      setNotice({
        title: STAFF_TEXT.reactivated(member.fullName),
        hint: STAFF_TEXT.reactivatedHint(staffNoText(member.staffNo)),
      });
    } catch (err) {
      const failure = partialFailureOf(err);
      if (failure) setRowPartial({ name: member.fullName, failure });
      else setRowError({ id: member.id, text: errorText(err) });
    } finally {
      setBusyId(null);
      void load();
    }
  }

  return (
    <SevaMotion>
      <div className="flex flex-col gap-5">
        {notice ? (
          <Reveal key={notice.title}>
            <div
              role="status"
              className="flex items-start justify-between gap-3 rounded-(--radius-surface) border border-(--border) bg-(--card) p-4 shadow-(--shadow-raise)"
            >
              <div>
                <strong>{notice.title}</strong>
                {notice.hint ? <p className="text-(length:--text-meta) text-(--muted-foreground)">{notice.hint}</p> : null}
              </div>
              <Button variant="seva-ghost" size="sm" onClick={() => setNotice(null)}>
                {STAFF_TEXT.close}
              </Button>
            </div>
          </Reveal>
        ) : null}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Bilingual as="h1" en={STAFF_TEXT.pageTitle.en} kn={STAFF_TEXT.pageTitle.kn} />
            {staff ? (
              <p className="text-(length:--text-meta) text-(--muted-foreground)">{STAFF_TEXT.peopleCount(counts.all, counts.active)}</p>
            ) : null}
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <input
              type="search"
              aria-label={STAFF_TEXT.searchLabel}
              placeholder={STAFF_TEXT.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(sevaControlClass, "min-w-0 flex-1 sm:w-72 sm:flex-none")}
            />
            <Button variant="seva-primary" onClick={() => setOnboarding(true)}>
              + {STAFF_TEXT.onboardButton.en}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented<StaffListFilter>
            name="staff-filter"
            label={STAFF_TEXT.filterLabel}
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", en: `${STAFF_TEXT.filterAll.en} ${counts.all}`, kn: STAFF_TEXT.filterAll.kn },
              { value: "active", en: `${STAFF_TEXT.filterActive.en} ${counts.active}`, kn: STAFF_TEXT.filterActive.kn },
              { value: "inactive", en: `${STAFF_TEXT.filterInactive.en} ${counts.inactive}`, kn: STAFF_TEXT.filterInactive.kn },
            ]}
          />
          <p className="text-(length:--text-meta) text-(--muted-foreground)">{STAFF_TEXT.inactiveLine}</p>
        </div>

        {rowPartial ? (
          <PartialFailureNotice
            lead={`${rowPartial.name}: ${sevaErrorMessage("partial_failure")}`}
            done={rowPartial.failure.done}
            failed={rowPartial.failure.failed}
            partly={rowPartial.failure.partly}
          />
        ) : null}

        {loadError ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-(--radius-control) bg-(--destructive-soft) p-4">
            <span className="text-(--destructive)">
              {STAFF_TEXT.loadFailed} {loadError}
            </span>
            <Button variant="seva-secondary" size="sm" onClick={() => void load()}>
              {STAFF_TEXT.tryAgain}
            </Button>
          </div>
        ) : null}

        {staff === null && !loadError ? (
          <p role="status" className="text-(--muted-foreground)">
            {STAFF_TEXT.loading}
          </p>
        ) : null}

        {staff !== null ? (
          <div className="overflow-x-auto rounded-(--radius-surface) border border-(--border) bg-(--card) shadow-(--shadow-card)">
            <table className="w-full min-w-[720px] border-collapse text-left text-(length:--text-ui)">
              <thead className="bg-(--secondary) text-(length:--text-meta) text-(--muted-foreground)">
                <tr>
                  <Bilingual as="th" en={STAFF_TEXT.colStaffNo.en} kn={STAFF_TEXT.colStaffNo.kn} className="px-4 py-3 font-semibold" />
                  <Bilingual as="th" en={STAFF_TEXT.colName.en} kn={STAFF_TEXT.colName.kn} className="px-4 py-3 font-semibold" />
                  <Bilingual as="th" en={STAFF_TEXT.colRole.en} kn={STAFF_TEXT.colRole.kn} className="px-4 py-3 font-semibold" />
                  <Bilingual as="th" en={STAFF_TEXT.colStatus.en} kn={STAFF_TEXT.colStatus.kn} className="px-4 py-3 font-semibold" />
                  <Bilingual
                    as="th"
                    en={STAFF_TEXT.colLastActive.en}
                    kn={STAFF_TEXT.colLastActive.kn}
                    className="px-4 py-3 font-semibold"
                  />
                  <th className="px-4 py-3">
                    <span className="sr-only">{STAFF_TEXT.colActions}</span>
                  </th>
                </tr>
              </thead>
              {/* The rows stagger in once, when the list arrives; rows shown later by the search or the filter just
                  appear, so nothing moves while a person types (plan A4P-4). */}
              <m.tbody variants={staggerChildren()} initial="hidden" animate="shown" onAnimationComplete={() => setArrived(true)}>
                {shown.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-(--muted-foreground)">
                      {STAFF_TEXT.empty}
                    </td>
                  </tr>
                ) : (
                  shown.map((member) => (
                    <StaffRow
                      key={member.id}
                      arrived={arrived}
                      member={member}
                      meStaffId={me.staffId}
                      can={can}
                      busy={busyId === member.id}
                      error={rowError?.id === member.id ? rowError.text : null}
                      onOpen={() => setOpenId(member.id)}
                      onReactivate={() => void reactivate(member)}
                    />
                  ))
                )}
              </m.tbody>
            </table>
          </div>
        ) : null}

        <StaffDrawer
          member={openMember}
          meStaffId={me.staffId}
          can={can}
          api={api}
          onClose={() => setOpenId(null)}
          onChanged={changed}
        />
        <OnboardDialog
          open={onboarding}
          onClose={() => setOnboarding(false)}
          api={api}
          sendInvite={sendInvite}
          can={can}
          onWritten={() => void load()}
          onOnboarded={({ staffNo }) =>
            setNotice({ title: STAFF_TEXT.inviteSent(staffNoText(staffNo)), hint: STAFF_TEXT.inviteSentHint })
          }
        />
      </div>
    </SevaMotion>
  );
}

interface StaffRowProps {
  /** The list's first rows have staggered in: this row, mounted later, shows at once. */
  arrived: boolean;
  member: StaffMember;
  meStaffId: string;
  can: StaffCan;
  busy: boolean;
  error: string | null;
  onOpen(): void;
  onReactivate(): void;
}

function StaffRow({ arrived, member, meStaffId, can, busy, error, onOpen, onReactivate }: StaffRowProps): JSX.Element {
  const rights = staffRights(can, meStaffId, member);
  const off = member.status === "inactive" || member.status === "deleted";
  const role = member.role ? STAFF_ROLE_LABEL[member.role].en : STAFF_TEXT.noRole;
  return (
    <m.tr
      variants={enterVariants}
      initial={arrived ? false : undefined}
      className={cn("border-t border-(--border) align-top", off && "text-(--muted-foreground)")}
    >
      <td className="px-4 py-3 font-semibold tabular-nums">{staffNoText(member.staffNo)}</td>
      <td className="px-4 py-3">
        <strong className="block">{member.fullName}</strong>
        <span className="block text-(length:--text-meta) text-(--muted-foreground)">{member.email}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {role}
          {member.viewOnly && member.role === "temple_admin" ? <ViewOnlyBadge /> : null}
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={member.status} />
      </td>
      <td className="px-4 py-3 text-(length:--text-meta)">{lastActiveText(member)}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {rights.self ? (
            <span className="text-(length:--text-meta) text-(--muted-foreground)">{STAFF_TEXT.you}</span>
          ) : null}
          {rights.reactivate ? (
            <PendingButton
              variant="seva-secondary"
              size="sm"
              pending={busy}
              pendingLabel={STAFF_TEXT.saving}
              aria-label={STAFF_TEXT.reactivateFor(member.fullName)}
              onClick={onReactivate}
            >
              {STAFF_TEXT.reactivate.en}
            </PendingButton>
          ) : null}
          {!rights.self && hasAnyRight(rights) ? (
            <Button variant="seva-ghost" size="sm" aria-label={STAFF_TEXT.rowActionsFor(member.fullName)} onClick={onOpen}>
              {STAFF_TEXT.open}
            </Button>
          ) : null}
          {!rights.self && !hasAnyRight(rights) && member.status !== "deleted" ? (
            <span className="text-(length:--text-meta) text-(--muted-foreground)">{STAFF_TEXT.superAdminOnly}</span>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="mt-1 text-(length:--text-meta) text-(--destructive)">
            {error}
          </p>
        ) : null}
      </td>
    </m.tr>
  );
}

export default StaffList;
