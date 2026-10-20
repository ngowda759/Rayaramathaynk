/**
 * Browser client for the seva report routes (DB §12). Every call carries the signed-in person's Bearer token; the
 * server decides who may see what (reports need `reports.view`, phone numbers `export.with_phones`).
 */

import type { Period } from "@/lib/seva/time";
import type {
  AuditEntry,
  AuditType,
  DashboardAnswer,
  DayCloseListRow,
  ExportPage,
  FestivalReport,
  SevaSummaryReport,
} from "@/lib/seva/server/reports";
import type { ExportPart } from "@/lib/seva/schemas";
import type { ContinuityRow } from "@/types/seva-reports";
import { sevaFetch } from "./http";

export type { AuditEntry, AuditType, DashboardAnswer, DayCloseListRow, ExportPage, FestivalReport, SevaSummaryReport };

function withQuery(path: string, params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `${path}?${text}` : path;
}

export function reportsApi(token: () => Promise<string>) {
  const get = async <T>(path: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> =>
    sevaFetch<T>(withQuery(path, params), { token: await token() });

  return {
    dashboard(period: Period): Promise<DashboardAnswer> {
      return get("/api/seva/reports/dashboard", { period });
    },
    continuity(from: string, to: string): Promise<ContinuityRow[]> {
      return get("/api/seva/reports/continuity", { from, to });
    },
    sevaSummary(from: string, to: string): Promise<SevaSummaryReport> {
      return get("/api/seva/reports/seva-summary", { from, to });
    },
    festival(festivalId: string, compareYear: number): Promise<FestivalReport> {
      return get("/api/seva/reports/festival", { festivalId, compareYear });
    },
    audit(f: { type?: AuditType; staffId?: string; from?: string; to?: string; cursor?: string }): Promise<{
      rows: AuditEntry[];
      nextCursor: string | null;
    }> {
      return get("/api/seva/reports/audit", f);
    },
    dayCloses(from: string, to: string): Promise<DayCloseListRow[]> {
      return get("/api/seva/reports/day-closes", { from, to });
    },
    export(p: { part: ExportPart; from: string; to: string; cursor?: string; includePhones: boolean }): Promise<ExportPage> {
      return get("/api/seva/reports/export", {
        part: p.part,
        from: p.from,
        to: p.to,
        cursor: p.cursor,
        includePhones: p.includePhones ? true : undefined,
      });
    },
    async exportAudit(b: {
      format: "xlsx" | "csv" | "tally" | "print";
      from: string;
      to: string;
      parts: ExportPart[];
      includePhones: boolean;
    }): Promise<void> {
      await sevaFetch<unknown>("/api/seva/reports/export/audit", { method: "POST", body: b, token: await token() });
    },
  };
}
