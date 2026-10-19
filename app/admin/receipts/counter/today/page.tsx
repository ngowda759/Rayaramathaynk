"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type JSX } from "react";

import { SevaGate } from "@/components/seva/shell/SevaGate";
import { TodayList } from "@/components/seva/today/TodayList";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { useAuth } from "@/hooks/useAuth";
import { useSevaMe } from "@/hooks/seva/useSevaMe";
import { openSevaDb, type SevaDb } from "@/lib/seva/offline/db";
import { deviceHeader, getDeviceCredentials } from "@/lib/seva/offline/device";
import { TODAY } from "@/lib/seva/strings/today";
import { SevaClientError } from "@/services/seva/http";

interface ThisPc {
  db: SevaDb | null;
  /** `x-seva-device` of this registered counter PC; null on any other computer. */
  header: string | null;
}

/** Opens this PC's IndexedDB and reads its counter credentials; a browser without IndexedDB gets neither. */
function useThisPc(): ThisPc | null {
  const [pc, setPc] = useState<ThisPc | null>(null);
  useEffect(() => {
    let alive = true;
    let opened: SevaDb | null = null;
    void (async () => {
      let db: SevaDb | null = null;
      let header: string | null = null;
      try {
        db = await openSevaDb();
        const credentials = await getDeviceCredentials(db);
        header = credentials ? deviceHeader(credentials) : null;
      } catch {
        // No IndexedDB here (private window, blocked storage): the page still lists from the office.
      }
      if (alive) {
        opened = db;
        setPc({ db, header });
      } else {
        db?.close();
      }
    })();
    return () => {
      alive = false;
      opened?.close();
    };
  }, []);
  return pc;
}

function TodayReceipts(): JSX.Element {
  const { me, can } = useSevaMe();
  const { user } = useAuth();
  const pc = useThisPc();

  const token = useCallback(async (): Promise<string> => {
    if (!user) throw new SevaClientError("unauthenticated", 401, "Sign in again to continue.");
    return user.getIdToken();
  }, [user]);

  if (!me || !pc) {
    return (
      <div role="status" className="py-8 text-center">
        <Bilingual en={TODAY.loading.en} kn={TODAY.loading.kn} className="text-(--muted-foreground)" />
      </div>
    );
  }
  return <TodayList me={me} can={can} token={token} deviceHeader={pc.header} db={pc.db} />;
}

/**
 * Today's receipts at the counter (DB §9.8-9.9): list, cancel (a whole group or one date), DUPLICATE reprint and the
 * spoiled-print reissue. A receptionist sees it only on their registered counter PC; every call carries the PC's
 * device header and the server checks each action again.
 */
export default function TodayReceiptsPage(): JSX.Element {
  return (
    <SevaGate action="receipts.list">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Bilingual as="h1" en={TODAY.title.en} kn={TODAY.title.kn} className="text-(length:--text-h2) font-semibold text-(--foreground)" />
          <Link
            href="/admin/receipts/counter"
            className="text-(length:--text-ui) font-semibold text-(--link) underline-offset-4 hover:underline"
          >
            {TODAY.backToCounter.en}
          </Link>
        </div>
        <TodayReceipts />
      </main>
    </SevaGate>
  );
}
