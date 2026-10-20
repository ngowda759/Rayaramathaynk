"use client";

import Link from "next/link";
import { useId, type JSX } from "react";

import { SkeletonRows } from "@/components/seva/motion/PageSkeleton";
import { PendingContent, PendingLine } from "@/components/seva/motion/PendingLine";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Chip, type ChipTone } from "@/components/seva/ui/Chip";
import { Segmented } from "@/components/seva/ui/Segmented";
import { Button } from "@/components/ui/button";
import { sevaControlClass } from "@/components/ui/input";
import { formatRupees, toPaise } from "@/lib/seva/money";
import { historyActionLabel } from "@/lib/seva/strings/receipt";
import { AUDIT, AUDIT_ACTION, REPORTS } from "@/lib/seva/strings/reports";
import type { Bi } from "@/lib/seva/strings/common";
import { businessDate, istParts } from "@/lib/seva/time";
import type { AuditEntry, AuditType } from "@/services/seva/reports.service";
import { SEVA_ROUTES, receiptPath } from "@/lib/seva/routes";

export type AuditTypeFilter = AuditType | "all";

export interface AuditPerson {
  staffId: string;
  label: string;
}

const LONG_DAY = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** 'Sunday 18 October 2026' for an IST date. */
function dayHeading(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return LONG_DAY.format(new Date(Date.UTC(y, m - 1, d))).replace(",", "");
}

function clock(iso: string): string {
  const p = istParts(new Date(iso));
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** A rupee string from an audit row ('150.00') as 'Rs 150'; null when it is not an amount. */
function rupeesOf(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  try {
    const paise = toPaise(value);
    return formatRupees(paise, { decimals: paise % 100 !== 0 });
  } catch {
    return null;
  }
}

export function auditActionLabel(action: string): Bi {
  return AUDIT_ACTION[action] ?? historyActionLabel(action);
}

/** What changed, in a few words, from the row's before and after (rate, changed amount, day-close cash). */
export function auditChange(entry: AuditEntry): string | null {
  const before = entry.before ?? {};
  const after = entry.after ?? {};
  if (entry.action === "seva.rate_change") {
    const from = rupeesOf(before.amount);
    const to = rupeesOf(after.amount);
    return from && to ? `${from} -> ${to}` : null;
  }
  if (entry.action === "receipt.amount_changed") {
    const from = rupeesOf(before.catalogue_rate);
    const to = rupeesOf(after.unit_rate);
    return from && to ? `${from} -> ${to} a unit` : null;
  }
  if (entry.action === "dayclose.close") {
    const expected = rupeesOf(after.cash_expected);
    const counted = rupeesOf(after.cash_counted);
    return expected && counted ? `Expected cash ${expected}, counted ${counted}` : null;
  }
  return null;
}

function toneOf(action: string): ChipTone {
  if (action.startsWith("receipt.cancel") || action === "receipt.reissue_spoiled" || action === "receipt.superseded") return "critical";
  if (action === "receipt.amount_changed" || action === "seva.rate_change") return "attention";
  return "neutral";
}

function linkOf(entry: AuditEntry): { href: string; label: string } | null {
  if (entry.entity === "receipt" && entry.entityId) {
    return { href: receiptPath(entry.entityId), label: AUDIT.openReceipt };
  }
  if (entry.entity === "day_close") return { href: SEVA_ROUTES.dayCloses, label: AUDIT.openDayClose };
  return null;
}

function who(entry: AuditEntry): string {
  if (!entry.by) return AUDIT.system;
  const name = entry.by.name ?? AUDIT.system;
  return entry.by.staffNo === null ? name : `${name} (${String(entry.by.staffNo).padStart(3, "0")})`;
}

export interface AuditTrailProps {
  entries: AuditEntry[];
  type: AuditTypeFilter;
  onType(next: AuditTypeFilter): void;
  person: string;
  people: AuditPerson[];
  onPerson(staffId: string): void;
  /** The first page is loading: skeleton rows under the filters rather than "nothing found". */
  loading?: boolean;
  /** A new filter is loading: the earlier entries stay, marked busy, with the inline pending line above them. */
  pending?: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onMore(): void;
}

/**
 * Audit trail (DB §12.4): everything that changed money or rules, newest first, grouped by IST day; filter by type and
 * person; each entry says who, when and why, with a link to the receipt or the day closes.
 */
export function AuditTrail({
  entries,
  type,
  onType,
  person,
  people,
  onPerson,
  loading = false,
  pending = false,
  hasMore,
  loadingMore,
  onMore,
}: AuditTrailProps): JSX.Element {
  const id = useId();
  const days: { date: string; entries: AuditEntry[] }[] = [];
  for (const entry of entries) {
    const date = businessDate(new Date(entry.at));
    const last = days[days.length - 1];
    if (last && last.date === date) last.entries.push(entry);
    else days.push({ date, entries: [entry] });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="max-w-full overflow-x-auto">
          <Segmented
            name={`${id}-type`}
            label={AUDIT.type}
            options={AUDIT.types.map((t) => ({ value: t.value, en: t.en }))}
            value={type}
            onChange={onType}
          />
        </div>
        <div className="flex min-w-48 flex-col gap-1.5">
          <Bilingual as="label" htmlFor={`${id}-person`} en={AUDIT.person.en} kn={AUDIT.person.kn} className="text-(length:--text-meta) font-semibold" />
          <select id={`${id}-person`} value={person} onChange={(e) => onPerson(e.target.value)} className={sevaControlClass}>
            <option value="">{AUDIT.everyone}</option>
            {people.map((p) => (
              <option key={p.staffId} value={p.staffId}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <PendingLine pending={pending && !loading} label={REPORTS.loading.en} data-report-pending="true" />
      {loading ? <SkeletonRows rows={6} label={REPORTS.loading.en} data-report-skeleton="" /> : null}
      <PendingContent pending={pending && !loading} data-testid="audit-list" className="flex flex-col gap-5">
        {days.length === 0 && !loading ? (
          <Bilingual as="div" en={AUDIT.empty.en} kn={AUDIT.empty.kn} className="py-6 text-center text-(--muted-foreground)" />
        ) : null}
        {days.map((day) => (
          <section key={day.date} aria-label={dayHeading(day.date)} className="flex flex-col gap-2">
            <h3 className="text-(length:--text-meta) font-semibold text-(--muted-foreground)">{dayHeading(day.date)}</h3>
            <ol className="flex flex-col gap-2">
              {day.entries.map((entry) => {
                const label = auditActionLabel(entry.action);
                const change = auditChange(entry);
                const link = linkOf(entry);
                return (
                  <li key={entry.id} className="flex flex-col gap-1.5 rounded-(--radius-surface) border border-(--border) bg-(--card) p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <Bilingual en={change ? `${label.en} · ${change}` : label.en} kn={label.kn} className="font-semibold text-(--foreground)" />
                      <Chip tone={toneOf(entry.action)}>{label.en}</Chip>
                    </div>
                    {entry.receiptNo ? (
                      <span className="font-mono text-(length:--text-meta) text-(--muted-foreground) tabular-nums">{entry.receiptNo}</span>
                    ) : null}
                    <p className="text-(length:--text-ui) text-(--foreground)">
                      {entry.reason ? <>&ldquo;{entry.reason}&rdquo;</> : <span className="text-(--muted-foreground)">{AUDIT.noReason}</span>}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 text-(length:--text-meta) text-(--muted-foreground)">
                      <span>
                        {who(entry)} · <time dateTime={entry.at}>{clock(entry.at)}</time>
                      </span>
                      {link ? (
                        <Link href={link.href} className="font-semibold text-(--link) underline-offset-4 hover:underline">
                          {link.label}
                        </Link>
                      ) : null}
                    </p>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </PendingContent>

      {hasMore ? (
        <div className="flex justify-center">
          <Button variant="seva-secondary" onClick={onMore} loading={loadingMore}>
            {AUDIT.showMore}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default AuditTrail;
