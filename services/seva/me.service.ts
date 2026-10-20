/**
 * Browser client for GET /api/seva/me: the signed-in staff member's role, allowed actions and, with a registered
 * counter PC's header, its counter. Failures arrive as SevaClientError (services/seva/http.ts).
 */
import type { SevaMe } from "@/types/seva";
import { sevaFetch } from "./http";

export function meApi(token: () => Promise<string>, device: () => string | null): { get(): Promise<SevaMe> } {
  return {
    async get(): Promise<SevaMe> {
      return sevaFetch<SevaMe>("/api/seva/me", { method: "GET", token: await token(), deviceHeader: device() });
    },
  };
}
