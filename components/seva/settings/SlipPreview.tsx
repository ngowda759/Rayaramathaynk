import type { JSX } from "react";

import { ReceiptSlip } from "@/components/seva/slip/ReceiptSlip";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { formatReceiptNo } from "@/lib/seva/numbering";
import { toSlipModel } from "@/lib/seva/print/slip-model";
import { RS } from "@/lib/seva/strings/receipt-settings";
import { businessDate, istParts } from "@/lib/seva/time";
import type { IssuedReceipt, SlipSettings } from "@/types/seva";

import { SettingsCard } from "./ReceiptSettingsFields";

/**
 * Settings - Receipts: a live preview of the printed slip (DB §13.2, §10.1). It renders the real `ReceiptSlip` from
 * the real `toSlipModel`, so what you see here is what the counter prints - header photos, English name first with
 * Kannada under it (C-03), which devotee details print, footer and blessing. The receipt is a fixed sample with no
 * phone number (C-16).
 */

export interface SlipPreviewProps {
  settings: SlipSettings;
  /** The signed-in person's staff number, so the sample number looks like theirs. */
  staffNo: number;
  now: Date;
  siteUrl: string;
}

/** A sample QR token (22 characters, the shape of a real one); it opens nothing. */
const SAMPLE_TOKEN = "PreviewSampleToken0001";

/** The sample receipt the preview prints: one Paaduka Pooja, paid in cash, made now at Counter 1. */
export function sampleReceipt(staffNo: number, now: Date): IssuedReceipt {
  const p = istParts(now);
  return {
    id: null,
    clientReceiptId: "preview",
    receiptNo: formatReceiptNo({ series: "C1", staffNo, channel: null, month: p.month, year: p.year, running: 124 }),
    seriesCode: "C1",
    sevaDate: businessDate(now),
    groupNo: "G-preview",
    position: 1,
    count: 1,
    orderTotalPaise: 50_500,
    totalPaise: 50_500,
    lines: [
      {
        lineNo: 1,
        sevaId: "preview",
        code: "PP",
        nameEn: "Paaduka Pooja",
        nameKn: "ಪಾದುಕಾ ಪೂಜೆ",
        quantity: 1,
        unitRatePaise: 50_500,
        amountPaise: 50_500,
        changed: false,
        prasadamItems: "Laddu",
      },
    ],
    payment: { mode: "cash" },
    devotee: {
      name: "Venkatesh Rao",
      gotra: "Kashyapa",
      gotraKn: "ಕಾಶ್ಯಪ",
      nakshatra: "Rohini",
      nakshatraKn: "ರೋಹಿಣಿ",
      rashi: "Vrishabha",
      rashiKn: "ವೃಷಭ",
    },
    qrToken: SAMPLE_TOKEN,
    issuedAt: now.toISOString(),
    issuedBy: { name: "Sample", staffNo },
    counterName: "Counter 1",
    channel: "counter",
    issuedOffline: false,
    status: "issued",
    printCount: 0,
    prasadam: "pending",
  };
}

export function SlipPreview({ settings, staffNo, now, siteUrl }: SlipPreviewProps): JSX.Element {
  const model = toSlipModel(sampleReceipt(staffNo, now), settings, { siteUrl });
  return (
    <SettingsCard title={RS.previewTitle} hint={RS.previewHint} testId="slip-preview">
      <div className="overflow-x-auto rounded-(--radius-control) bg-(--muted) p-3">
        <div className="mx-auto w-fit bg-white shadow-(--shadow-card)">
          <ReceiptSlip model={model} />
        </div>
      </div>
      <Bilingual as="div" en={RS.paper.en} kn={RS.paper.kn} className="meta" />
    </SettingsCard>
  );
}

export default SlipPreview;
