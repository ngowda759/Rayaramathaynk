"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";

import { BoardSummary, type BoardSummaryModel } from "@/components/seva/export/BoardSummary";
import { PageSkeleton } from "@/components/seva/motion/PageSkeleton";
import { PendingContent, PendingLine } from "@/components/seva/motion/PendingLine";
import { SevaGate } from "@/components/seva/shell/SevaGate";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { useSevaMe } from "@/hooks/seva/useSevaMe";
import { useAuth } from "@/hooks/useAuth";
import {
  BOARD_AUDIT_PARTS,
  BOARD_EXPORT_PARTS,
  boardAttention,
  collectChangeReasons,
  collectExportData,
  collectionsChart,
  previousRange,
  quickRange,
  rangeTotals,
} from "@/lib/seva/export/collect";
import { BOARD } from "@/lib/seva/strings/export";
import { SevaClientError } from "@/services/seva/http";
import { reportsApi } from "@/services/seva/reports.service";
import { settingsApi } from "@/services/seva/settings.service";
import type { SlipSettings } from "@/types/seva";

/**
 * The board print summary (DB §12.6, C-42): `/admin/receipts/reports/summary?from&to`, opened from Export. It reads
 * the range's receipts and cancellations from the export API, the previous period for the chart's ghost line
 * (`previousRange`), the changed-amount reasons from the audit trail, the seva summary (with last year and rate changes), the day closes and the number continuity; then
 * writes the `export.download` audit row (format 'print') once, and shows the two A4 sheets with a print button.
 * "Save as PDF" in the browser's print window gives the PDF.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type Phase = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; model: BoardSummaryModel };

/** The temple header and blessing from the receipt template; plain defaults when this person cannot read it. */
async function slipSettings(token: () => Promise<string>): Promise<Pick<SlipSettings, "templeNameEn" | "templeNameKn" | "footerBlessing">> {
  const fallback = { templeNameEn: "Sri Raghavendra Swamy Matha", templeNameKn: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ", footerBlessing: "" };
  try {
    const slip: Partial<SlipSettings> = await settingsApi(token).getTemplate();
    return {
      templeNameEn: typeof slip.templeNameEn === "string" && slip.templeNameEn.trim() ? slip.templeNameEn : fallback.templeNameEn,
      templeNameKn: typeof slip.templeNameKn === "string" ? slip.templeNameKn : fallback.templeNameKn,
      footerBlessing: typeof slip.footerBlessing === "string" ? slip.footerBlessing : "",
    };
  } catch {
    return fallback;
  }
}

function SummaryScreen(): JSX.Element {
  const params = useSearchParams();
  const { user } = useAuth();
  const { me } = useSevaMe();
  // Opened from the Reports tab with no dates: this month, like the Export page's default.
  const asked = params.has("from") || params.has("to");
  const [fallback] = useState(() => quickRange("month", new Date()));
  const from = asked ? (params.get("from") ?? "") : fallback.from;
  const to = asked ? (params.get("to") ?? "") : fallback.to;
  const validRange = ISO_DATE.test(from) && ISO_DATE.test(to) && from <= to;

  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<(Exclude<Phase, { kind: "loading" }> & { key: string }) | null>(null);
  const loadKey = `${from}|${to}|${attempt}`;
  // An answer for another range (or an earlier try) means the new one is still loading. While it loads, the earlier
  // sheets stay on screen (marked busy, with the pending line); before any sheets there is the page skeleton.
  const shown = result && (result.key === loadKey || result.kind === "ready") ? result : null;
  const pending = shown !== null && shown.key !== loadKey;
  const audited = useRef<string | null>(null);

  const token = useCallback(async (): Promise<string> => {
    if (!user) throw new SevaClientError("unauthenticated", 401, "Sign in again.");
    return user.getIdToken();
  }, [user]);
  const api = useMemo(() => reportsApi(token), [token]);
  const preparedBy = me ? `${me.name} (${me.staffNo})` : "";

  useEffect(() => {
    if (!validRange || !user || !me) return;
    let alive = true;
    const asked = loadKey;
    void (async () => {
      try {
        const prev = previousRange(from, to);
        const [data, prevData, sevaSummary, dayCloses, continuity, changeReasons, slip] = await Promise.all([
          collectExportData({ from, to, parts: BOARD_EXPORT_PARTS, includePhones: false }, api),
          collectExportData({ from: prev.from, to: prev.to, parts: ["receipts"], includePhones: false }, api),
          api.sevaSummary(from, to),
          api.dayCloses(from, to),
          api.continuity(from, to),
          collectChangeReasons(api, { from, to }),
          slipSettings(token),
        ]);
        const key = `${from}|${to}`;
        if (audited.current !== key) {
          // Every export is recorded (DB 12.6), once per range; the summary is not shown when the record cannot be
          // written. The key is taken before the call so an overlapping reload does not record it twice.
          audited.current = key;
          try {
            await api.exportAudit({ format: "print", from, to, parts: BOARD_AUDIT_PARTS, includePhones: false });
          } catch (err) {
            audited.current = null;
            throw err;
          }
        }
        const differences = dayCloses.filter((d) => d.badge !== "balanced");
        const model: BoardSummaryModel = {
          templeNameEn: slip.templeNameEn,
          templeNameKn: slip.templeNameKn,
          blessing: slip.footerBlessing.trim() || BOARD.defaultBlessing.kn,
          range: { from, to },
          preparedBy,
          preparedAt: new Date().toISOString(),
          totals: rangeTotals(data.receipts),
          prevTotals: rangeTotals(prevData.receipts),
          chart: collectionsChart(data.receipts, prevData.receipts, { from, to }, prev),
          attention: boardAttention({
            receipts: data.receipts,
            dayCloseDifferences: differences.length,
            openGaps: continuity.reduce((sum, row) => sum + row.openGaps, 0),
          }),
          sevas: sevaSummary.sevas ?? [],
          sevaTotals: sevaSummary.totals ?? { receipts: 0, amountPaise: 0, lastYearReceipts: 0, lastYearAmountPaise: 0 },
          rateChanges: sevaSummary.rateChanges ?? [],
          dayCloses: differences,
          cancelledChanged: data.cancelledChanged,
          changeReasons,
        };
        if (alive) setResult({ key: asked, kind: "ready", model });
      } catch (err) {
        if (alive) setResult({ key: asked, kind: "error", message: err instanceof SevaClientError ? err.message : BOARD.failed.en });
      }
    })();
    return () => {
      alive = false;
    };
  }, [validRange, from, to, user, me, api, token, preparedBy, loadKey]);

  if (!validRange) {
    return (
      <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 p-6 text-center">
        <Bilingual as="div" en={BOARD.badRange.en} kn={BOARD.badRange.kn} className="font-semibold" />
        <Link href="/admin/receipts/reports/export" className="text-(--link) underline">
          {BOARD.backToExport.en}
        </Link>
      </div>
    );
  }

  if (shown === null) {
    return (
      <div data-report-skeleton="">
        <PageSkeleton variant="detail" />
      </div>
    );
  }

  if (shown.kind === "error") {
    return (
      <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 p-6 text-center">
        <p className="font-semibold">{shown.message}</p>
        <Button variant="seva-primary" onClick={() => setAttempt((n) => n + 1)}>
          {BOARD.tryAgain.en}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/receipts/reports/export" className="text-(length:--text-ui) text-(--link) underline">
          {BOARD.backToExport.en}
        </Link>
        <div className="flex flex-col items-end gap-1">
          {/* Never prints the earlier range's sheets while the new range is being prepared. */}
          <Button variant="seva-primary" onClick={() => window.print()} disabled={pending}>
            {BOARD.print.en}
          </Button>
          <span className="text-(length:--text-meta) text-(--muted-foreground)">{BOARD.printHint.en}</span>
        </div>
      </div>
      <PendingLine pending={pending} label={BOARD.loading.en} data-report-pending="true" />
      <PendingContent pending={pending} data-testid="report-content">
        <BoardSummary model={shown.model} />
      </PendingContent>
    </div>
  );
}

export default function BoardSummaryPage(): JSX.Element {
  return (
    <SevaGate action="export.basic">
      <Suspense fallback={null}>
        <SummaryScreen />
      </Suspense>
    </SevaGate>
  );
}
