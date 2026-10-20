/**
 * Browser client for the close-day routes (DB §9.10). From the counter PC the device header goes along, so a
 * receptionist's call is judged against that PC's own counter; closing needs the network (C-28).
 */

import type { DayCloseRequest } from "@/lib/seva/schemas";
import type { DayClosePrep } from "@/types/seva-dayclose";
import { sevaFetch } from "./http";

export function dayCloseApi(token: () => Promise<string>, device: () => string | null) {
  const call = async <T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> =>
    sevaFetch<T>(path, { ...init, token: await token(), deviceHeader: device() });

  return {
    prepare(p?: { counterId?: number; date?: string }): Promise<DayClosePrep> {
      const search = new URLSearchParams();
      if (p?.counterId !== undefined) search.set("counterId", String(p.counterId));
      if (p?.date) search.set("date", p.date);
      const text = search.toString();
      return call<DayClosePrep>(text ? `/api/seva/day-close?${text}` : "/api/seva/day-close");
    },
    close(b: DayCloseRequest): Promise<{ dayCloseId: string }> {
      return call<{ dayCloseId: string }>("/api/seva/day-close", { method: "POST", body: b });
    },
    async reopen(dayCloseId: string, reason: string): Promise<void> {
      await call<unknown>("/api/seva/day-close/reopen", { method: "POST", body: { dayCloseId, reason } });
    },
  };
}
