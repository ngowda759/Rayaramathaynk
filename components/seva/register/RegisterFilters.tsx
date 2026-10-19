"use client";

import { useId, type JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { sevaControlClass } from "@/components/ui/input";
import { PAYMENT_FILTERS, REGISTER, STATUS_FILTERS } from "@/lib/seva/strings/reports";
import type { CatalogueSeva, PaymentMode } from "@/types/seva";
import type { ReceiptStatusFilter } from "@/types/seva-receipts";
import type { ReceiptListParams } from "@/services/seva/receipts.service";

/** The register's filters (DB §12.3). Empty strings mean "all". */
export interface RegisterFilterValue {
  from: string;
  to: string;
  sevaId: string;
  mode: "" | PaymentMode;
  status: "" | ReceiptStatusFilter;
  q: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MODES = new Set<string>(PAYMENT_FILTERS.map((p) => p.value).filter((v) => v !== ""));
const STATUSES = new Set<string>(STATUS_FILTERS.map((s) => s.value).filter((v) => v !== ""));

/**
 * Filters from a link (`?status=changed&from=2026-10-01&to=2026-10-18&q=Lakshmi`, as the dashboard's cards send them).
 * Unknown values are ignored; the dates default to today.
 */
export function filtersFromSearch(params: Pick<URLSearchParams, "get">, today: string): RegisterFilterValue {
  const date = (key: string): string | null => {
    const value = params.get(key);
    return value && ISO_DATE.test(value) ? value : null;
  };
  const from = date("from") ?? today;
  const to = date("to") ?? (from > today ? from : today);
  const mode = params.get("mode") ?? "";
  const status = params.get("status") ?? "";
  return {
    from,
    to: to < from ? from : to,
    sevaId: params.get("sevaId") ?? "",
    mode: MODES.has(mode) ? (mode as PaymentMode) : "",
    status: STATUSES.has(status) ? (status as ReceiptStatusFilter) : "",
    q: (params.get("q") ?? "").slice(0, 80),
  };
}

/** The list query for `receiptsApi.list`; empty filters are left out. */
export function toListParams(v: RegisterFilterValue): ReceiptListParams {
  const params: ReceiptListParams = {};
  if (v.from) params.from = v.from;
  if (v.to) params.to = v.to;
  if (v.sevaId) params.sevaId = v.sevaId;
  if (v.mode) params.mode = v.mode;
  if (v.status) params.status = v.status;
  const q = v.q.trim();
  if (q) params.q = q;
  return params;
}

export interface RegisterFiltersProps {
  value: RegisterFilterValue;
  sevas: CatalogueSeva[];
  onChange(next: RegisterFilterValue): void;
}

const labelClass = "text-(length:--text-meta) font-semibold text-(--foreground)";

export function RegisterFilters({ value, sevas, onChange }: RegisterFiltersProps): JSX.Element {
  const id = useId();
  const set = <K extends keyof RegisterFilterValue>(key: K, next: RegisterFilterValue[K]): void => onChange({ ...value, [key]: next });

  return (
    <section
      aria-label={REGISTER.filters.en}
      className="grid grid-cols-2 gap-3 rounded-(--radius-surface) border border-(--border) bg-(--card) p-4 md:grid-cols-3 xl:grid-cols-6"
    >
      <div className="flex flex-col gap-1.5">
        <Bilingual as="label" htmlFor={`${id}-from`} en={REGISTER.from.en} kn={REGISTER.from.kn} className={labelClass} />
        <input
          id={`${id}-from`}
          type="date"
          value={value.from}
          max={value.to || undefined}
          onChange={(e) => set("from", e.target.value)}
          className={sevaControlClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Bilingual as="label" htmlFor={`${id}-to`} en={REGISTER.to.en} kn={REGISTER.to.kn} className={labelClass} />
        <input
          id={`${id}-to`}
          type="date"
          value={value.to}
          min={value.from || undefined}
          onChange={(e) => set("to", e.target.value)}
          className={sevaControlClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Bilingual as="label" htmlFor={`${id}-seva`} en={REGISTER.seva.en} kn={REGISTER.seva.kn} className={labelClass} />
        <select id={`${id}-seva`} value={value.sevaId} onChange={(e) => set("sevaId", e.target.value)} className={sevaControlClass}>
          <option value="">{REGISTER.allSevas}</option>
          {sevas.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nameEn}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Bilingual as="label" htmlFor={`${id}-mode`} en={REGISTER.payment.en} kn={REGISTER.payment.kn} className={labelClass} />
        <select
          id={`${id}-mode`}
          value={value.mode}
          onChange={(e) => set("mode", e.target.value as RegisterFilterValue["mode"])}
          className={sevaControlClass}
        >
          {PAYMENT_FILTERS.map((p) => (
            <option key={p.value || "all"} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Bilingual as="label" htmlFor={`${id}-status`} en={REGISTER.status.en} kn={REGISTER.status.kn} className={labelClass} />
        <select
          id={`${id}-status`}
          value={value.status}
          onChange={(e) => set("status", e.target.value as RegisterFilterValue["status"])}
          className={sevaControlClass}
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value || "all"} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-2 flex flex-col gap-1.5 md:col-span-1">
        <Bilingual as="label" htmlFor={`${id}-q`} en={REGISTER.search.en} kn={REGISTER.search.kn} className={labelClass} />
        <input
          id={`${id}-q`}
          type="search"
          value={value.q}
          maxLength={80}
          placeholder={REGISTER.searchPlaceholder}
          onChange={(e) => set("q", e.target.value)}
          className={sevaControlClass}
        />
      </div>
    </section>
  );
}

export default RegisterFilters;
