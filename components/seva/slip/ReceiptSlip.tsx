import type { CSSProperties, JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { COMMON } from "@/lib/seva/strings/common";
import { slipBox } from "@/lib/seva/print/paper";
import type { SlipModel } from "@/lib/seva/print/slip-model";

import { SlipQr } from "./SlipQr";

function Photo({ src, side }: { src: string | null; side: "left" | "right" }): JSX.Element {
  // Header photos come from Settings - Receipts as stored URLs; a plain <img> lets printSlips wait for each to load,
  // which next/image's lazy loading would defeat on a print page.
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img className="php" src={src} alt="" data-side={side} /> : <span className="php" aria-hidden="true" />;
}

/**
 * The slip's sizes for its paper (plan A4S-7), as custom properties that styles/seva/print.css reads. They are
 * computed at run time from the paper setting (lib/seva/print/paper.ts), so they cannot be fixed utility classes.
 */
function paperVars(m: SlipModel): CSSProperties {
  const box = slipBox(m.paper);
  const l = m.layout;
  const vars: Record<`--${string}`, string> = {
    "--slip-w": `${box.widthMm}mm`,
    "--slip-h": box.heightMm === null ? "auto" : `${box.heightMm}mm`,
    "--slip-pad": `${m.paper.padMm}mm`,
    "--slip-body": `${l.bodyPt}pt`,
    "--slip-name": `${l.templeNamePt}pt`,
    "--slip-devotee": `${l.devoteeNamePt}pt`,
    "--slip-date": `${l.sevaDatePt}pt`,
    "--slip-total": `${l.totalPt}pt`,
    "--slip-qr": `${l.qrMm}mm`,
    "--slip-photo": `${l.photoMm}mm`,
  };
  return vars as CSSProperties;
}

/**
 * One printed receipt on its configured paper (Design Book 10.1 order, 10.2 type; plan A4S-7 sizes): A5 by default,
 * A6, one-third A4, an 80 or 58 mm roll, or a custom size, always portrait. Styles live in styles/seva/print.css
 * under `.slip`. English first, Kannada on its own line under it (the shared `Bilingual`).
 */
export function ReceiptSlip({ model }: { model: SlipModel }): JSX.Element {
  const m = model;
  // Fixed sheets keep the photo columns (empty when no photo is set); a roll drops them when they are not printed.
  const photoColumns = m.layout.variant !== "roll" || m.layout.showPhotos;
  return (
    <article
      className="slip"
      aria-label={`Receipt ${m.receiptNo}, seva date ${m.sevaDateLine}`}
      data-paper={m.paper.id}
      data-variant={m.layout.variant}
      data-photos={photoColumns ? "shown" : "hidden"}
      style={paperVars(m)}
    >
      <header className="s-head">
        {photoColumns ? <Photo src={m.header.photoLeft} side="left" /> : null}
        <div className="nm">
          <Bilingual as="div" className="e" en={m.header.nameEn} kn={m.header.nameKn} />
          {m.header.address.map((a, i) => (
            <div className="ad" key={`ad-${i}`}>
              {a}
            </div>
          ))}
        </div>
        {photoColumns ? <Photo src={m.header.photoRight} side="right" /> : null}
      </header>
      {m.header.registration ? <div className="s-reg">{m.header.registration}</div> : <div className="s-reg s-reg-empty" />}

      <div className="s-body">
        {m.duplicate ? (
          <Bilingual as="div" className="s-dup" en={COMMON.duplicate.en.toUpperCase()} kn={COMMON.duplicate.kn} />
        ) : null}

        <div className="s-no">
          <Bilingual en={COMMON.receiptNo.en} kn={COMMON.receiptNo.kn} />
          <b>{m.receiptNo}</b>
          <span>{m.issuedLine}</span>
          {m.duplicate ? (
            <span>
              Reprinted {m.duplicate.at} by {m.duplicate.byStaffNo}
            </span>
          ) : null}
        </div>

        <div className="s-date">
          <Bilingual en={COMMON.sevaDate.en} kn={COMMON.sevaDate.kn} />
          <b>{m.sevaDateLine}</b>
          {m.groupLine ? <div className="grp">{m.groupLine}</div> : null}
        </div>

        <dl className="kv">
          {m.devotee.map((d, i) => (
            <div className={i === 0 ? "kv-row kv-name" : "kv-row"} key={d.label.en}>
              <dt>
                <Bilingual en={d.label.en} kn={d.label.kn} />
              </dt>
              <dd>
                <Bilingual en={d.value} kn={d.valueKn} />
              </dd>
            </div>
          ))}
        </dl>

        <div className="s-lines">
          <div className="s-sh">
            <span>Seva / Qty x Rate</span>
            <span>Amount</span>
          </div>
          {m.lines.map((l, i) => (
            <div className="sl" key={`${i}-${l.nameEn}`}>
              <Bilingual as="div" className="n" en={l.nameEn} kn={l.nameKn} />
              <div className="r">
                <span className="a">{l.amount}</span>
                <span className="q">
                  {l.changed ? <span className="chg">Changed </span> : null}
                  {l.qtyRate}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="s-money">
          <div className="s-tot">
            <Bilingual en={COMMON.total.en} kn={COMMON.total.kn} />
            <span className="v">{m.total}</span>
          </div>
          <div>{m.totalWords}</div>
          <div>{m.paymentLine}</div>
        </div>

        <div className="s-qr">
          <SlipQr url={m.qrUrl} />
          <div>
            {m.prasadamLine ? (
              <Bilingual as="div" className="pr" en={m.prasadamLine.en} kn={m.prasadamLine.kn} />
            ) : null}
            <div className="by">{m.issuedBy}</div>
          </div>
        </div>

        <footer className="s-foot">
          {m.footer.map((f, i) => (
            <div key={`ft-${i}`}>{f}</div>
          ))}
          {m.blessing ? (
            <div className="bl" lang="kn">
              {m.blessing}
            </div>
          ) : null}
        </footer>
      </div>
    </article>
  );
}

export default ReceiptSlip;
