"use client";

import Link from "next/link";
import { useCallback, useId, useMemo, useState, type JSX } from "react";
import { m } from "framer-motion";

import { PendingButton } from "@/components/seva/motion/PendingButton";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Segmented } from "@/components/seva/ui/Segmented";
import { sevaControlClass } from "@/components/ui/input";
import { useSevaMe } from "@/hooks/seva/useSevaMe";
import { useAuth } from "@/hooks/useAuth";
import {
  EXPORT_TICKS,
  collectExportData,
  csvFiles,
  exportFileName,
  forTicks,
  partsFor,
  quickRange,
  type ExportApi,
  type ExportFormat,
  type ExportTick,
  type QuickRange,
} from "@/lib/seva/export/collect";
import { buildCsv } from "@/lib/seva/export/csv";
import { DEFAULT_TALLY_COLUMNS, tallyRows, type TallyColumnNames, type TallyLedgers } from "@/lib/seva/export/tally";
import { zipFiles } from "@/lib/seva/export/zip";
import {
  EXPORT,
  FORMAT_LABELS,
  PREPARE_LABELS,
  RANGE_LABELS,
  SHEET_NAMES_PREVIEW,
  TICK_LABELS,
  partOf,
} from "@/lib/seva/strings/export";
import type { Bi } from "@/lib/seva/strings/common";
import { SevaClientError } from "@/services/seva/http";
import { reportsApi } from "@/services/seva/reports.service";
import { settingsApi } from "@/services/seva/settings.service";

/**
 * The Export form (DB §12.6; mockup dashboard.html#export). Format: Excel (seven sheets), CSV (each ticked part a
 * file, zipped), Tally import, or the board print summary (opened in a new tab, printed or saved as PDF from there,
 * C-42). Ranges: Today, This month, Last month, This year, or custom dates. The data is paged out of the export API and
 * the file is built here in the browser (C-41). "Devotee phone numbers" is off by default and offered only to people
 * with `export.with_phones` (C-16). Every download is reported to the export audit before the file is handed over;
 * when the audit cannot be written, nothing is downloaded. While the data is paged out a progress bar shows "Part n of
 * m"; the download button is a pending button from the click until the file is saved (plan A4P-3).
 */

const QUICK: readonly QuickRange[] = ["today", "month", "lastMonth", "year"];
const FORMATS: readonly ExportFormat[] = ["xlsx", "csv", "tally", "print"];

const MIME: Record<Exclude<ExportFormat, "print">, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "application/zip",
  tally: "text/csv;charset=utf-8",
};

/** While busy: the part being paged out (1-based) of how many, or null once the file itself is being put together. */
type Step = { part: number; of: number } | null;

type Status = { kind: "idle" } | { kind: "busy"; step: Step } | { kind: "done"; text: Bi } | { kind: "error"; message: string };

/** Hands bytes to the browser's downloads under `name`. */
function saveFile(content: BlobPart, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Give the browser a moment to start the download before the object URL goes away.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

const TALLY_KEYS = Object.keys(DEFAULT_TALLY_COLUMNS) as (keyof TallyColumnNames)[];

/** The temple's Tally ledger and column names from the counter rules; plain defaults where none are set (C-55). */
async function tallySettings(token: () => Promise<string>): Promise<{ ledgers: TallyLedgers; cols: Partial<TallyColumnNames> }> {
  const ledgers: TallyLedgers = { cash: "Cash", upi: "UPI", online: "Online" };
  const cols: Partial<TallyColumnNames> = {};
  try {
    const rules = await settingsApi(token).getRules();
    if (rules.tallyCashLedger.trim()) ledgers.cash = rules.tallyCashLedger.trim();
    if (rules.tallyUpiLedger.trim()) ledgers.upi = rules.tallyUpiLedger.trim();
    if (rules.tallyOnlineLedger.trim()) ledgers.online = rules.tallyOnlineLedger.trim();
    for (const key of TALLY_KEYS) {
      const name = rules.tallyColumns?.[key]?.trim();
      if (name) cols[key] = name;
    }
  } catch {
    // Settings unreadable for this person: the defaults are still a valid import file.
  }
  return { ledgers, cols };
}

function messageOf(err: unknown): string {
  if (err instanceof SevaClientError) return err.message;
  if (err instanceof RangeError && (err.message === "missing_income_ledger" || err.message === "unbalanced_voucher")) {
    return EXPORT.missingLedger.en;
  }
  return EXPORT.failed.en;
}

export function ExportForm(): JSX.Element {
  const { user } = useAuth();
  const { me, can } = useSevaMe();
  const ids = useId();

  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [quick, setQuick] = useState<QuickRange | "custom">("month");
  const [range, setRange] = useState(() => quickRange("month", new Date()));
  const [ticks, setTicks] = useState<ExportTick[]>([...EXPORT_TICKS]);
  const [includePhones, setIncludePhones] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const canPhones = can("export.with_phones");

  const token = useCallback(async (): Promise<string> => {
    if (!user) throw new SevaClientError("unauthenticated", 401, "Sign in again.");
    return user.getIdToken();
  }, [user]);
  const api = useMemo(() => reportsApi(token), [token]);

  const pickQuick = (kind: QuickRange): void => {
    setQuick(kind);
    setRange(quickRange(kind, new Date()));
  };

  const setDate = (which: "from" | "to", value: string): void => {
    setQuick("custom");
    setRange((r) => ({ ...r, [which]: value }));
  };

  const toggleTick = (tick: ExportTick, on: boolean): void => {
    setTicks((list) => (on ? EXPORT_TICKS.filter((t) => t === tick || list.includes(t)) : list.filter((t) => t !== tick)));
  };

  const badRange = !range.from || !range.to || range.from > range.to;
  const usesTicks = format === "xlsx" || format === "csv";
  const phones = includePhones && canPhones && usesTicks;

  const run = async (): Promise<void> => {
    if (badRange) {
      setStatus({ kind: "error", message: EXPORT.badRange.en });
      return;
    }
    if (usesTicks && ticks.length === 0) {
      setStatus({ kind: "error", message: EXPORT.nothingTicked.en });
      return;
    }
    const query = `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
    if (format === "print") {
      // The summary page writes the audit row itself once it has the data.
      window.open(`/admin/receipts/reports/summary?${query}`, "_blank", "noopener");
      setStatus({ kind: "done", text: EXPORT.printOpened });
      return;
    }

    const parts = partsFor(format, ticks);
    setStatus({ kind: "busy", step: { part: 1, of: parts.length } });
    try {
      // The progress follows the pages asked for: each request names its part, parts come one after another.
      const counted: ExportApi = {
        export: (p) => {
          const at = parts.indexOf(p.part) + 1;
          if (at > 0) setStatus({ kind: "busy", step: { part: at, of: parts.length } });
          return api.export(p);
        },
      };
      const raw = await collectExportData({ from: range.from, to: range.to, parts, includePhones: phones }, counted);
      setStatus({ kind: "busy", step: null });
      const data = {
        ...forTicks(raw, ticks),
        range: { from: range.from, to: range.to, label: RANGE_LABELS[quick].en },
        preparedBy: me ? `${me.name} (${me.staffNo})` : "",
        preparedAt: new Date().toISOString(),
      };

      let content: BlobPart;
      if (format === "xlsx") {
        // The Excel library is loaded only when an Excel file is asked for.
        const { buildExportWorkbook } = await import("@/lib/seva/excel/workbook");
        content = await buildExportWorkbook(data, { includePhones: phones });
      } else if (format === "csv") {
        const zipped = zipFiles(csvFiles(data, ticks, { includePhones: phones }));
        content = new Uint8Array(zipped);
      } else {
        const { ledgers, cols } = await tallySettings(token);
        const rows = tallyRows(raw.receipts, ledgers, cols);
        content = buildCsv(rows[0], rows.slice(1));
      }

      await api.exportAudit({ format, from: range.from, to: range.to, parts, includePhones: phones });
      saveFile(content, exportFileName(format, range.from, range.to), MIME[format]);
      setStatus({ kind: "done", text: EXPORT.saved });
    } catch (err) {
      setStatus({ kind: "error", message: messageOf(err) });
    }
  };

  const busy = status.kind === "busy";

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Bilingual as="h2" en={EXPORT.title.en} kn={EXPORT.title.kn} className="text-(length:--text-h2) font-semibold" />
          <Bilingual as="div" en={EXPORT.intro.en} kn={EXPORT.intro.kn} className="text-(length:--text-meta) text-(--muted-foreground)" />
        </div>
        <Link href="/admin/receipts/reports" className="text-(length:--text-ui) text-(--link) underline">
          {EXPORT.backToReports.en}
        </Link>
      </div>

      <section className="flex flex-col gap-5 rounded-(--radius-surface) border border-(--border) bg-(--card) p-5 shadow-(--shadow-card)">
        <div className="flex flex-col gap-2">
          <Bilingual as="div" en={EXPORT.format.en} kn={EXPORT.format.kn} className="text-(length:--text-meta) font-semibold" />
          <Segmented
            name={`${ids}-format`}
            label={EXPORT.format.en}
            options={FORMATS.map((f) => ({ value: f, en: FORMAT_LABELS[f].en, kn: FORMAT_LABELS[f].kn }))}
            value={format}
            onChange={(f) => {
              setFormat(f);
              setStatus({ kind: "idle" });
            }}
          />
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex w-full flex-col gap-1 sm:w-48">
            <Bilingual as="label" htmlFor={`${ids}-from`} en={EXPORT.from.en} kn={EXPORT.from.kn} className="text-(length:--text-meta) font-semibold" />
            <input
              id={`${ids}-from`}
              type="date"
              className={sevaControlClass}
              value={range.from}
              aria-invalid={badRange || undefined}
              onChange={(e) => setDate("from", e.target.value)}
            />
          </div>
          <div className="flex w-full flex-col gap-1 sm:w-48">
            <Bilingual as="label" htmlFor={`${ids}-to`} en={EXPORT.to.en} kn={EXPORT.to.kn} className="text-(length:--text-meta) font-semibold" />
            <input
              id={`${ids}-to`}
              type="date"
              className={sevaControlClass}
              value={range.to}
              aria-invalid={badRange || undefined}
              onChange={(e) => setDate("to", e.target.value)}
            />
          </div>
          <div role="group" aria-label={EXPORT.quickRange.en} className="flex flex-wrap gap-2">
            {QUICK.map((kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={quick === kind}
                onClick={() => pickQuick(kind)}
                className={
                  quick === kind
                    ? "min-h-[38px] cursor-pointer rounded-full border border-(--primary-press) bg-(--primary) px-4 text-(length:--text-ui) font-semibold text-(--primary-foreground)"
                    : "min-h-[38px] cursor-pointer rounded-full border border-(--border) bg-(--secondary) px-4 text-(length:--text-ui) font-semibold text-(--foreground) hover:border-(--border-strong)"
                }
              >
                {RANGE_LABELS[kind].en}
              </button>
            ))}
          </div>
        </div>
        {badRange ? (
          <p role="alert" className="text-(length:--text-meta) text-(--destructive)">
            {EXPORT.badRange.en}
          </p>
        ) : null}

        {usesTicks ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-(length:--text-meta) font-semibold">
              <Bilingual en={EXPORT.included.en} kn={EXPORT.included.kn} />
            </legend>
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {EXPORT_TICKS.map((tick) => (
                <label key={tick} className="flex min-h-[34px] items-start gap-2 text-(length:--text-ui)">
                  <input
                    type="checkbox"
                    className="mt-1 size-[18px] accent-(--primary-press)"
                    checked={ticks.includes(tick)}
                    onChange={(e) => toggleTick(tick, e.target.checked)}
                  />
                  <Bilingual en={TICK_LABELS[tick].en} kn={TICK_LABELS[tick].kn} />
                </label>
              ))}
              {canPhones ? (
                <label className="flex min-h-[34px] items-start gap-2 text-(length:--text-ui)">
                  <input
                    type="checkbox"
                    className="mt-1 size-[18px] accent-(--primary-press)"
                    checked={includePhones}
                    aria-describedby={`${ids}-phones-hint`}
                    onChange={(e) => setIncludePhones(e.target.checked)}
                  />
                  <Bilingual en={EXPORT.phones.en} kn={EXPORT.phones.kn} />
                </label>
              ) : null}
            </div>
            {canPhones ? (
              <p id={`${ids}-phones-hint`} className="text-(length:--text-meta) text-(--muted-foreground)">
                {EXPORT.phonesHint.en}
              </p>
            ) : null}
          </fieldset>
        ) : null}

        <Preview format={format} />

        <Bilingual as="div" en={EXPORT.audited.en} kn={EXPORT.audited.kn} className="text-(length:--text-meta) text-(--muted-foreground)" />

        {status.kind === "error" && !badRange ? (
          <p role="alert" className="rounded-(--radius-surface) bg-(--destructive-soft) p-3 font-semibold text-(--destructive)">
            {status.message}
          </p>
        ) : null}
        <div aria-live="polite">
          {status.kind === "busy" ? <ExportProgress step={status.step} /> : null}
          {status.kind === "done" ? (
            <Bilingual as="div" en={status.text.en} kn={status.text.kn} className="rounded-(--radius-surface) bg-(--ok-soft) p-3" />
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Link
            href="/admin/receipts/reports"
            className="inline-flex min-h-[46px] items-center rounded-(--radius-control) px-4 text-(length:--text-ui) font-semibold text-(--foreground) hover:bg-(--secondary)"
          >
            {EXPORT.cancel.en}
          </Link>
          <PendingButton
            variant="seva-primary"
            pending={busy}
            pendingLabel={EXPORT.preparingShort.en}
            disabled={badRange}
            action={run}
          >
            {PREPARE_LABELS[format]}
          </PendingButton>
        </div>
      </section>
    </div>
  );
}

/** The bar and the "Part n of m" line while the export pages through its parts; full while the file is put together. */
function ExportProgress({ step }: { step: Step }): JSX.Element {
  const line = step ? partOf(step.part, step.of) : EXPORT.building;
  // Half way into the current part, since its number of pages is not known in advance.
  const done = step ? Math.min(1, Math.max(0, (step.part - 0.5) / step.of)) : 1;
  return (
    <div className="flex flex-col gap-2" data-testid="export-progress">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Bilingual as="div" en={EXPORT.preparing.en} kn={EXPORT.preparing.kn} className="text-(--muted-foreground)" />
        <Bilingual as="span" en={line.en} kn={line.kn} className="text-(length:--text-meta) font-semibold tabular-nums" />
      </div>
      <div
        role="progressbar"
        aria-label={EXPORT.progress.en}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(done * 100)}
        aria-valuetext={line.en}
        className="h-2 w-full overflow-hidden rounded-full bg-(--muted)"
      >
        <m.div
          className="h-full w-full origin-left rounded-full bg-(--primary)"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: done }}
        />
      </div>
    </div>
  );
}

function Preview({ format }: { format: ExportFormat }): JSX.Element {
  const box = "flex flex-col gap-2 rounded-(--radius-surface) bg-(--muted) p-4";
  const label = "text-(length:--text-meta) font-semibold";
  const note = "text-(length:--text-meta) text-(--muted-foreground)";
  if (format === "xlsx") {
    return (
      <div className={box} data-testid="export-preview">
        <Bilingual as="div" en={EXPORT.previewXlsx.en} kn={EXPORT.previewXlsx.kn} className={label} />
        <ul className="flex flex-wrap gap-2" aria-label={EXPORT.previewXlsx.en}>
          {SHEET_NAMES_PREVIEW.map((name) => (
            <li
              key={name}
              className="inline-flex h-8 items-center rounded-lg border border-(--border) bg-(--secondary) px-3 text-(length:--text-meta) font-semibold"
            >
              {name}
            </li>
          ))}
        </ul>
        <Bilingual as="div" en={EXPORT.previewXlsxNote.en} kn={EXPORT.previewXlsxNote.kn} className={note} />
      </div>
    );
  }
  if (format === "csv") {
    return (
      <div className={box} data-testid="export-preview">
        <Bilingual as="div" en={EXPORT.previewCsv.en} kn={EXPORT.previewCsv.kn} className={label} />
        <Bilingual as="div" en={EXPORT.previewCsvNote.en} kn={EXPORT.previewCsvNote.kn} className={note} />
      </div>
    );
  }
  if (format === "tally") {
    return (
      <div className={box} data-testid="export-preview">
        <Bilingual as="div" en={EXPORT.previewTally.en} kn={EXPORT.previewTally.kn} className={label} />
        <Bilingual as="div" en={EXPORT.previewTallyNote.en} kn={EXPORT.previewTallyNote.kn} className={note} />
      </div>
    );
  }
  return (
    <div className={box} data-testid="export-preview">
      <Bilingual as="div" en={EXPORT.previewPrint.en} kn={EXPORT.previewPrint.kn} className={label} />
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-(length:--text-ui)">
        <li>
          <Bilingual en={EXPORT.previewPrintPage1.en} kn={EXPORT.previewPrintPage1.kn} />
        </li>
        <li>
          <Bilingual en={EXPORT.previewPrintPage2.en} kn={EXPORT.previewPrintPage2.kn} />
        </li>
      </ol>
      <Bilingual as="div" en={EXPORT.previewPrintNote.en} kn={EXPORT.previewPrintNote.kn} className={note} />
    </div>
  );
}

export default ExportForm;
