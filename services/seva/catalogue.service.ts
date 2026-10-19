/**
 * Browser client for the seva catalogue routes (`/api/seva/sevas*`). Every call asks the token getter for the signed-in
 * person's Firebase ID token, so a page left open never sends an expired one; the server checks the role (DB §6.5).
 * Failures arrive as SevaClientError (services/seva/http.ts).
 */

import type { SevaUpsert } from "@/lib/seva/schemas";
import type { CatalogueSeva } from "@/types/seva";
import type { RateHistoryEntry, SaveSevaResult } from "@/types/seva-settings";
import { sevaFetch } from "./http";

export interface CatalogueApi {
  list(): Promise<CatalogueSeva[]>;
  /** Creates (no id) or edits a seva; a rate change needs `reason`. */
  save(seva: SevaUpsert, reason?: string): Promise<SaveSevaResult>;
  reorder(ids: string[]): Promise<void>;
  history(id: string): Promise<RateHistoryEntry[]>;
}

export function catalogueApi(token: () => Promise<string>): CatalogueApi {
  return {
    async list() {
      const body = await sevaFetch<{ sevas: CatalogueSeva[] }>("/api/seva/sevas", { token: await token() });
      return body.sevas;
    },
    async save(seva, reason) {
      const payload: SevaUpsert = reason === undefined ? seva : { ...seva, reason };
      if (seva.id) {
        return sevaFetch<SaveSevaResult>(`/api/seva/sevas/${encodeURIComponent(seva.id)}`, {
          method: "PUT",
          body: payload,
          token: await token(),
        });
      }
      return sevaFetch<SaveSevaResult>("/api/seva/sevas", { method: "POST", body: payload, token: await token() });
    },
    async reorder(ids) {
      await sevaFetch<unknown>("/api/seva/sevas/reorder", { method: "PUT", body: { ids }, token: await token() });
    },
    async history(id) {
      const body = await sevaFetch<{ history: RateHistoryEntry[] }>(`/api/seva/sevas/${encodeURIComponent(id)}`, {
        token: await token(),
      });
      return body.history;
    },
  };
}
