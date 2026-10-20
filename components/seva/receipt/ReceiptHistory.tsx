import type { JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { RECEIPT, historyActionLabel } from "@/lib/seva/strings/receipt";
import type { ReceiptDetail } from "@/types/seva-receipts";

const TIME = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : TIME.format(d);
}

/**
 * The receipt's history, newest first (DB §12.3): issue, first print, reprints, cancel, amount changes and prasadam.
 * Sorted here as well as on the server, so the order never depends on the caller.
 */
export function ReceiptHistory({ history }: { history: ReceiptDetail["history"] }): JSX.Element {
  const rows = [...history].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return (
    <section className="space-y-3">
      <Bilingual as="h2" en={RECEIPT.history.en} kn={RECEIPT.history.kn} className="text-base font-semibold" />
      {rows.length === 0 ? (
        <Bilingual as="div" en={RECEIPT.historyEmpty.en} kn={RECEIPT.historyEmpty.kn} className="text-(--muted-foreground)" />
      ) : (
        <ol aria-label={RECEIPT.history.en} className="space-y-3 border-l-2 border-(--border) pl-4">
          {rows.map((row, i) => {
            const label = historyActionLabel(row.action);
            return (
              <li key={`${row.at}-${row.action}-${i}`} className="space-y-0.5">
                <Bilingual as="div" en={label.en} kn={label.kn} className="font-semibold" />
                <div className="text-(length:--text-meta) text-(--muted-foreground)">
                  <time dateTime={row.at}>{when(row.at)}</time>
                  {row.by ? ` - ${row.by}` : null}
                </div>
                {row.reason ? <div className="text-(length:--text-meta)">&ldquo;{row.reason}&rdquo;</div> : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export default ReceiptHistory;
