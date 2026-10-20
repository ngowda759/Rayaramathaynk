/**
 * Browser client for Settings - Devotee lists (`/api/seva/settings/lists`, plan A4P-5): read the gotra, nakshatra
 * and rashi lists, add a gotra, or change one item. Every call asks the token getter for a fresh Firebase ID token.
 * Failures arrive as SevaClientError (services/seva/http.ts).
 */

import type { ListItemSaveRequest } from "@/lib/seva/schemas";
import type { SevaListItem, SevaListKind, SevaLists } from "@/types/seva";
import { sevaFetch } from "./http";

export interface ListsApi {
  getLists(): Promise<SevaLists>;
  saveItem(input: ListItemSaveRequest): Promise<{ kind: SevaListKind; item: SevaListItem }>;
}

const PATH = "/api/seva/settings/lists";

export function listsApi(token: () => Promise<string>): ListsApi {
  return {
    getLists: async () => sevaFetch<SevaLists>(PATH, { token: await token() }),
    saveItem: async (input) =>
      sevaFetch<{ kind: SevaListKind; item: SevaListItem }>(PATH, { method: "POST", body: input, token: await token() }),
  };
}
