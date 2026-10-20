/**
 * Browser client for the prasadam counter routes (DB §11). The prasadam counter is a phone or any PC, so no device
 * header is sent. Answers carry no amounts and no phone number.
 */

import type { PrasadamLookupResult } from "@/types/seva-prasadam";
import { sevaFetch } from "./http";

export function prasadamApi(token: () => Promise<string>) {
  async function call<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
    return sevaFetch<T>(path, { ...init, token: await token() });
  }

  return {
    lookup(q: string): Promise<PrasadamLookupResult> {
      return call(`/api/seva/prasadam/lookup?${new URLSearchParams({ q }).toString()}`);
    },
    give(b: { receiptId: string; confirmOffDate: boolean }): Promise<PrasadamLookupResult> {
      return call("/api/seva/prasadam/give", { method: "POST", body: b });
    },
    async undo(b: { receiptId: string; reason?: string }): Promise<void> {
      await call<{ ok: true }>("/api/seva/prasadam/undo", { method: "POST", body: b });
    },
  };
}
