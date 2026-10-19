"use client";

import { useEffect, useState, type JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { formatRupees } from "@/lib/seva/money";
import { SETTINGS_TEXT as T } from "@/lib/seva/strings/settings";
import { businessDate, formatSevaDate } from "@/lib/seva/time";
import type { CatalogueApi } from "@/services/seva/catalogue.service";
import { SevaClientError } from "@/services/seva/http";
import type { RateHistoryEntry } from "@/types/seva-settings";

export interface RateHistoryProps {
  sevaId: string;
  api: Pick<CatalogueApi, "history">;
}

type State = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; entries: RateHistoryEntry[] };

function rupees(paise: number): string {
  return formatRupees(paise, { decimals: paise % 100 !== 0 });
}

/** "1 Apr 2026" - the IST date of the change, without the weekday. */
function dayOf(iso: string): string {
  return formatSevaDate(businessDate(new Date(iso))).replace(/^\w{3} /, "");
}

/** The seva's rate changes, newest first, with the reason and who changed it (DB §13.1, mockup `sevas-drawer`). */
export function RateHistory({ sevaId, api }: RateHistoryProps): JSX.Element {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    api
      .history(sevaId)
      .then((entries) => {
        if (live) setState({ kind: "ready", entries });
      })
      .catch((err: unknown) => {
        if (live) setState({ kind: "error", message: err instanceof SevaClientError ? err.message : T.historyFailed });
      });
    return () => {
      live = false;
    };
  }, [api, sevaId]);

  return (
    <section className="flex flex-col gap-3">
      <Bilingual as="h3" en={T.rateHistory.en} kn={T.rateHistory.kn} className="text-(length:--text-h3) font-semibold" />
      {state.kind === "loading" ? (
        <p role="status" className="text-(--muted-foreground)">
          {T.loading.en}
        </p>
      ) : state.kind === "error" ? (
        <p role="alert" className="text-(--destructive)">
          {state.message}
        </p>
      ) : state.entries.length === 0 ? (
        <p className="text-(--muted-foreground)">{T.historyEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {state.entries.map((entry, i) => (
            <li key={`${entry.at}-${i}`} className="flex flex-col gap-0.5 border-l-2 border-(--border-strong) pl-3">
              <strong className="tabular-nums">
                {entry.oldPaise === null
                  ? T.historyAdded(dayOf(entry.at), rupees(entry.newPaise))
                  : T.historyChanged(dayOf(entry.at), rupees(entry.oldPaise), rupees(entry.newPaise))}
              </strong>
              {entry.reason ? <span>{entry.reason}</span> : null}
              {entry.by ? <span className="text-(length:--text-meta) text-(--muted-foreground)">{entry.by}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default RateHistory;
