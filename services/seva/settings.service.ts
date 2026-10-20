/**
 * Browser client for the seva settings routes (`/api/seva/settings/*`): slip template, counter rules, cash
 * denominations, festival days and counters (DB §13.2-13.4). Every call asks the token getter for a fresh Firebase ID
 * token, so a page left open never sends an expired one. Failures arrive as SevaClientError (services/seva/http.ts).
 * The cash-difference note and changed-amount reason are always required, so there is no switch for them here.
 */

import type { CounterRequest, DenominationsRequest, FestivalRequest, SettingsPatch } from "@/lib/seva/schemas";
import type { SlipSettings } from "@/types/seva";
import type { CounterItem, CounterRules, FestivalItem, NewCounter } from "@/types/seva-settings";
import { sevaFetch } from "./http";

export type TemplatePatch = Partial<Pick<SettingsPatch, keyof SlipSettings>>;
export type RulesPatch = Partial<Pick<SettingsPatch, keyof CounterRules>>;

export interface SettingsApi {
  getTemplate(): Promise<SlipSettings>;
  saveTemplate(patch: TemplatePatch): Promise<void>;
  getRules(): Promise<CounterRules>;
  saveRules(patch: RulesPatch): Promise<void>;
  getDenominations(): Promise<DenominationsRequest>;
  saveDenominations(input: DenominationsRequest): Promise<void>;
  listFestivals(): Promise<FestivalItem[]>;
  /** Adds (no id) or edits a festival; the dates given replace its dates. */
  saveFestival(festival: FestivalRequest): Promise<{ id: string }>;
  listCounters(): Promise<CounterItem[]>;
  addCounter(input: Pick<CounterRequest, "name" | "place">): Promise<NewCounter>;
  updateCounter(id: number, patch: Partial<CounterRequest>): Promise<void>;
}

const BASE = "/api/seva/settings";

export function settingsApi(token: () => Promise<string>): SettingsApi {
  return {
    getTemplate: async () => sevaFetch<SlipSettings>(`${BASE}/template`, { token: await token() }),
    async saveTemplate(patch) {
      await sevaFetch<unknown>(`${BASE}/template`, { method: "PUT", body: patch, token: await token() });
    },
    getRules: async () => sevaFetch<CounterRules>(`${BASE}/rules`, { token: await token() }),
    async saveRules(patch) {
      await sevaFetch<unknown>(`${BASE}/rules`, { method: "PUT", body: patch, token: await token() });
    },
    getDenominations: async () => sevaFetch<DenominationsRequest>(`${BASE}/denominations`, { token: await token() }),
    async saveDenominations(input) {
      await sevaFetch<unknown>(`${BASE}/denominations`, { method: "PUT", body: input, token: await token() });
    },
    async listFestivals() {
      const body = await sevaFetch<{ festivals: FestivalItem[] }>(`${BASE}/festivals`, { token: await token() });
      return body.festivals;
    },
    async saveFestival(festival) {
      if (festival.id) {
        return sevaFetch<{ id: string }>(`${BASE}/festivals/${encodeURIComponent(festival.id)}`, {
          method: "PUT",
          body: festival,
          token: await token(),
        });
      }
      return sevaFetch<{ id: string }>(`${BASE}/festivals`, { method: "POST", body: festival, token: await token() });
    },
    async listCounters() {
      const body = await sevaFetch<{ counters: CounterItem[] }>(`${BASE}/counters`, { token: await token() });
      return body.counters;
    },
    addCounter: async (input) =>
      sevaFetch<NewCounter>(`${BASE}/counters`, {
        method: "POST",
        body: input,
        token: await token(),
      }),
    async updateCounter(id, patch) {
      await sevaFetch<unknown>(`${BASE}/counters/${encodeURIComponent(String(id))}`, {
        method: "PUT",
        body: patch,
        token: await token(),
      });
    },
  };
}
