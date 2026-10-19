"use client";

import { useState, type FormEvent, type JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { openSevaDb } from "@/lib/seva/offline/db";
import { newDeviceSecret, saveDeviceCredentials, sha256HexBrowser } from "@/lib/seva/offline/device";
import { nowThisPc, RS } from "@/lib/seva/strings/receipt-settings";
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

type RegisterBody = { counterId: number; secretHash: string; label: string };

export interface RegisterThisPcProps {
  counter: CounterItem;
  register(b: RegisterBody): Promise<{ deviceId: string }>;
  onRegistered(counterId: number): void;
  /** True when this PC already holds counter credentials (registering again replaces them). */
  alreadyRegistered: boolean;
}

type Phase = { kind: "closed" } | { kind: "open" } | { kind: "busy" } | { kind: "done" } | { kind: "error"; message: string };

export function RegisterThisPc({ counter, register, onRegistered, alreadyRegistered }: RegisterThisPcProps): JSX.Element {
  const [phase, setPhase] = useState<Phase>({ kind: "closed" });
  const [label, setLabel] = useState(counter.place ?? "");
  const formId = `register-pc-${counter.id}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (phase.kind === "busy") return;
    setPhase({ kind: "busy" });
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
      {alreadyRegistered ? <Bilingual as="div" en={RS.alreadyRegistered.en} kn={RS.alreadyRegistered.kn} className="font-semibold" /> : null}
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
