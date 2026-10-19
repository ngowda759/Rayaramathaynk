/**
 * Browser client for the seva settings routes (`/api/seva/settings/*`): slip template, counter rules, cash
 * denominations, festival days and counters (DB §13.2-13.4). Failures arrive as SevaClientError
 * (services/seva/http.ts). The cash-difference note and changed-amount reason are always required, so there is no
 * switch for them here.
 */

import type { CounterRequest, DenominationsRequest, FestivalRequest, SettingsPatch } from "@/lib/seva/schemas";
import type { CounterItem, CounterRules, FestivalItem, NewCounter } from "@/lib/seva/server/settings";
import type { SlipSettings } from "@/types/seva";
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

export function settingsApi(token: string): SettingsApi {
  return {
    getTemplate: () => sevaFetch<SlipSettings>(`${BASE}/template`, { token }),
    async saveTemplate(patch) {
      await sevaFetch<unknown>(`${BASE}/template`, { method: "PUT", body: patch, token });
    },
    getRules: () => sevaFetch<CounterRules>(`${BASE}/rules`, { token }),
    async saveRules(patch) {
      await sevaFetch<unknown>(`${BASE}/rules`, { method: "PUT", body: patch, token });
    },
    getDenominations: () => sevaFetch<DenominationsRequest>(`${BASE}/denominations`, { token }),
    async saveDenominations(input) {
      await sevaFetch<unknown>(`${BASE}/denominations`, { method: "PUT", body: input, token });
    },
    async listFestivals() {
      const body = await sevaFetch<{ festivals: FestivalItem[] }>(`${BASE}/festivals`, { token });
      return body.festivals;
    },
    saveFestival(festival) {
      if (festival.id) {
        return sevaFetch<{ id: string }>(`${BASE}/festivals/${encodeURIComponent(festival.id)}`, {
          method: "PUT",
          body: festival,
          token,
        });
      }
      return sevaFetch<{ id: string }>(`${BASE}/festivals`, { method: "POST", body: festival, token });
    },
    async listCounters() {
      const body = await sevaFetch<{ counters: CounterItem[] }>(`${BASE}/counters`, { token });
      return body.counters;
    },
    addCounter: (input) =>
      sevaFetch<NewCounter>(`${BASE}/counters`, {
        method: "POST",
        body: input,
        token,
      }),
    async updateCounter(id, patch) {
      await sevaFetch<unknown>(`${BASE}/counters/${encodeURIComponent(String(id))}`, { method: "PUT", body: patch, token });
    },
  };
}
