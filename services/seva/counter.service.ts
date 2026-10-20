/**
 * Browser client for the counter routes (DB §6.5). Every call carries the signed-in person's ID token and, from a
 * registered counter PC, its `x-seva-device` header (services/seva/http.ts). Failures arrive as SevaClientError.
 */
import type { HeartbeatAnswer } from "@/lib/seva/offline/heartbeat";
import type { RefusalReport, SetAsideReport } from "@/lib/seva/offline/refused";
import type { CounterBootstrap, CounterOrderPayload, IssueResponse, OutboxItem, SyncResponse } from "@/types/seva";
import { sevaFetch } from "./http";

type Token = () => Promise<string>;
type Device = () => string | null;

export function counterApi(token: Token, device: Device) {
  async function call<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
    return sevaFetch<T>(path, { method, body, token: await token(), deviceHeader: device() });
  }

  return {
    bootstrap(): Promise<CounterBootstrap> {
      return call<CounterBootstrap>("/api/seva/counter/bootstrap", "GET");
    },
    issue(p: CounterOrderPayload): Promise<IssueResponse> {
      return call<IssueResponse>("/api/seva/counter/orders", "POST", p);
    },
    sync(items: OutboxItem[]): Promise<SyncResponse> {
      return call<SyncResponse>("/api/seva/counter/sync", "POST", { items });
    },
    prints(receiptIds: string[]): Promise<{ receipts: { id: string; printCount: number; duplicate: boolean }[] }> {
      return call("/api/seva/counter/prints", "POST", { receiptIds });
    },
    heartbeat(b: { outboxCount: number; clockSkewMs: number; appVersion: string }): Promise<HeartbeatAnswer> {
      return call<HeartbeatAnswer>("/api/seva/counter/heartbeat", "POST", b);
    },
    /** Tells the office about outbox items it refused (A5-FIX F5-1). */
    reportRefused(items: RefusalReport[]): Promise<{ results: { seq: number; duplicate: boolean }[] }> {
      return call("/api/seva/counter/refused", "POST", { items });
    },
    /** Tells the office a temple admin set refused items aside on this PC, with the reason. */
    reportSetAside(items: SetAsideReport[]): Promise<{ results: { seq: number; duplicate: boolean }[] }> {
      return call("/api/seva/counter/refused/set-aside", "POST", { items });
    },
    registerDevice(b: { counterId: number; secretHash: string; label: string }): Promise<{ deviceId: string }> {
      return call("/api/seva/counter/devices", "POST", { action: "register", ...b });
    },
    replaceDevice(b: {
      counterId: number;
      secretHash: string;
      label: string;
      lastPrintedOfNo: number;
      reason: string;
    }): Promise<{ deviceId: string }> {
      return call("/api/seva/counter/devices", "POST", { action: "replace", ...b });
    },
  };
}
