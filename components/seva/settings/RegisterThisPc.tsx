"use client";

import { useState, type FormEvent, type JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { openSevaDb } from "@/lib/seva/offline/db";
import { getDeviceCredentials, newDeviceSecret, saveDeviceCredentials, sha256HexBrowser } from "@/lib/seva/offline/device";
import { pendingCount } from "@/lib/seva/offline/outbox";
import { nowThisPc, RS, sendWaitingFirst } from "@/lib/seva/strings/receipt-settings";
import type { CounterItem } from "@/types/seva-settings";

import { errorText, Notice, TextField } from "./ReceiptSettingsFields";

/**
 * "Register this PC" (DB §8.4, C-37): the PC makes a 32-byte random secret, sends only its SHA-256 hash with the
 * counter id and a label, and keeps the secret in its own IndexedDB with the device id the office answers. The secret
 * lives only in local variables here - never in React state, the request body or a log - so it exists in exactly two
 * places: this PC's IndexedDB and, hashed, the office's `counter_devices`.
 */

export interface DeviceKey {
  secret: string;
  secretHash: string;
}

/** A new device secret and its SHA-256 hash; only the hash is ever sent. */
export async function makeDeviceKey(): Promise<DeviceKey> {
  const secret = newDeviceSecret();
  return { secret, secretHash: await sha256HexBrowser(secret) };
}

/** Keeps the office's device id and this PC's secret in the counter database; throws when it cannot. */
export async function keepDeviceKey(deviceId: string, secret: string): Promise<void> {
  const db = await openSevaDb();
  try {
    await saveDeviceCredentials(db, { deviceId, secret });
  } finally {
    db.close();
  }
}

/** What this PC holds before Register or Replace: a counter key, and outbox items not sent yet. */
export interface ThisPcState {
  hasKey: boolean;
  waiting: number;
}

/** Reads this PC's stored device credentials and the outbox's pending count; throws when the database cannot open. */
export async function readThisPc(): Promise<ThisPcState> {
  const db = await openSevaDb();
  try {
    const [credentials, waiting] = await Promise.all([getDeviceCredentials(db), pendingCount(db)]);
    return { hasKey: credentials !== null, waiting };
  } finally {
    db.close();
  }
}

/**
 * Why this PC may not take a new counter key now, or null when it may (A4 security L-1). A PC whose outbox still holds
 * items must send them first: they carry its present key, and once that key is overwritten the office refuses them and
 * they can only be typed in again from the paper slips. Register also refuses a PC that already keeps a key, because
 * the office allows one live PC per counter; Replace is the way to give a counter a new PC or a new key.
 */
export async function thisPcRefusal(action: "register" | "replace"): Promise<string | null> {
  let pc: ThisPcState;
  try {
    pc = await readThisPc();
  } catch {
    return RS.pcNotRead.en;
  }
  if (pc.waiting > 0) return sendWaitingFirst(pc.waiting).en;
  if (action === "register" && pc.hasKey) return RS.alreadyRegistered.en;
  return null;
}

type RegisterBody = { counterId: number; secretHash: string; label: string };

export interface RegisterThisPcProps {
  counter: CounterItem;
  register(b: RegisterBody): Promise<{ deviceId: string }>;
  onRegistered(counterId: number): void;
}

type Phase = { kind: "closed" } | { kind: "open" } | { kind: "busy" } | { kind: "done" } | { kind: "error"; message: string };

export function RegisterThisPc({ counter, register, onRegistered }: RegisterThisPcProps): JSX.Element {
  const [phase, setPhase] = useState<Phase>({ kind: "closed" });
  const [label, setLabel] = useState(counter.place ?? "");
  const formId = `register-pc-${counter.id}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (phase.kind === "busy") return;
    setPhase({ kind: "busy" });
    const refusal = await thisPcRefusal("register");
    if (refusal) {
      setPhase({ kind: "error", message: refusal });
      return;
    }
    let deviceId: string;
    let secret: string;
    try {
      const key = await makeDeviceKey();
      secret = key.secret;
      const answer = await register({ counterId: counter.id, secretHash: key.secretHash, label: label.trim() });
      deviceId = answer.deviceId;
    } catch (err) {
      setPhase({ kind: "error", message: errorText(err, RS.loadFailed) });
      return;
    }
    try {
      await keepDeviceKey(deviceId, secret);
    } catch {
      setPhase({ kind: "error", message: RS.registerNotKept.en });
      return;
    }
    setPhase({ kind: "done" });
    onRegistered(counter.id);
  }

  if (phase.kind === "closed") {
    return (
      <Button type="button" variant="seva-secondary" size="sm" onClick={() => setPhase({ kind: "open" })} aria-controls={formId}>
        {RS.register.en}
      </Button>
    );
  }

  if (phase.kind === "done") {
    return <Notice kind="ok" text={nowThisPc(counter.name)} />;
  }

  const busy = phase.kind === "busy";
  return (
    <form id={formId} onSubmit={submit} noValidate className="flex w-full flex-col gap-3 rounded-(--radius-control) border border-(--border) bg-(--muted) p-3">
      <Bilingual as="div" en={RS.registerHint.en} kn={RS.registerHint.kn} className="meta" />
      <TextField
        id={`${formId}-label`}
        label={RS.pcLabel}
        hint={RS.pcLabelHint}
        value={label}
        onChange={setLabel}
        maxLength={120}
        className="max-w-sm"
      />
      {phase.kind === "error" ? <Notice kind="error" text={phase.message} /> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="seva-primary" size="sm" disabled={busy}>
          {busy ? RS.registering.en : RS.registerConfirm.en}
        </Button>
        <Button type="button" variant="seva-ghost" size="sm" disabled={busy} onClick={() => setPhase({ kind: "closed" })}>
          {RS.cancel.en}
        </Button>
      </div>
    </form>
  );
}

export default RegisterThisPc;
