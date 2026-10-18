import type { JSX } from "react";

import { COMMON } from "@/lib/seva/strings/common";
import type { SlipModel } from "@/lib/seva/print/slip-model";

import { SlipQr } from "./SlipQr";

function Kn({ children }: { children: string | null | undefined }): JSX.Element | null {
  return children ? (
    <span className="kn" lang="kn">
      {children}
    </span>
  ) : null;
}

function Photo({ src, side }: { src: string | null; side: "left" | "right" }): JSX.Element {
  // Header photos come from Settings - Receipts as stored URLs; a plain <img> lets printSlips wait for each to load,
  // which next/image's lazy loading would defeat on a print page.
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img className="php" src={src} alt="" data-side={side} /> : <span className="php" aria-hidden="true" />;
}

/**
 * One printed receipt, 89 x 199 mm inside the 99 x 210 mm page (Design Book 10.1 order, 10.2 type). Styles live in
 * styles/seva/print.css under `.slip`. English first, Kannada on its own line under it.
 */
export function ReceiptSlip({ model }: { model: SlipModel }): JSX.Element {
  const m = model;
  return (
    <article className="slip" aria-label={`Receipt ${m.receiptNo}, seva date ${m.sevaDateLine}`}>
      <header className="s-head">
        <Photo src={m.header.photoLeft} side="left" />
        <div className="nm">
          <div className="e">{m.header.nameEn}</div>
          <Kn>{m.header.nameKn}</Kn>
          {m.header.address.map((a) => (
            <div className="ad" key={a}>
              {a}
            </div>
          ))}
        </div>
        <Photo src={m.header.photoRight} side="right" />
      </header>
      {m.header.registration ? <div className="s-reg">{m.header.registration}</div> : <div className="s-reg s-reg-empty" />}

      <div className="s-body">
        {m.duplicate ? (
          <div className="s-dup">
            {COMMON.duplicate.en.toUpperCase()}
            <Kn>{COMMON.duplicate.kn}</Kn>
          </div>
        ) : null}

        <div className="s-no">
          <span>{COMMON.receiptNo.en}</span>
          <Kn>{COMMON.receiptNo.kn}</Kn>
          <b>{m.receiptNo}</b>
          <span>{m.issuedLine}</span>
          {m.duplicate ? (
            <span>
              Reprinted {m.duplicate.at} by {m.duplicate.byStaffNo}
            </span>
          ) : null}
        </div>

        <div className="s-date">
          <span>{COMMON.sevaDate.en}</span>
          <Kn>{COMMON.sevaDate.kn}</Kn>
          <b>{m.sevaDateLine}</b>
          {m.groupLine ? <div className="grp">{m.groupLine}</div> : null}
        </div>

        <dl className="kv">
          {m.devotee.map((d) => (
            <div className="kv-row" key={d.label.en}>
              <dt>
                {d.label.en}
                <Kn>{d.label.kn}</Kn>
              </dt>
              <dd>
                {d.value}
                <Kn>{d.valueKn}</Kn>
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
              <span className="n">{l.nameEn}</span>
              <span className="a">{l.amount}</span>
              <span className="kn" lang="kn">
                {l.nameKn ?? ""}
              </span>
              <span className="q">
                {l.changed ? <span className="chg">Changed </span> : null}
                {l.qtyRate}
              </span>
            </div>
          ))}
        </div>

        <div className="s-money">
          <div className="s-tot">
            <span>
              {COMMON.total.en}
              <Kn>{COMMON.total.kn}</Kn>
            </span>
            <span className="v">{m.total}</span>
          </div>
          <div>{m.totalWords}</div>
          <div>{m.paymentLine}</div>
        </div>

        <div className="s-qr">
          <SlipQr url={m.qrUrl} />
          <div>
            {m.prasadamLine ? (
              <>
                <b>{m.prasadamLine.en}</b>
                <div className="kn" lang="kn">
                  {m.prasadamLine.kn}
                </div>
              </>
            ) : null}
            <div className="by">{m.issuedBy}</div>
          </div>
        </div>

        <footer className="s-foot">
          {m.footer.map((f) => (
            <div key={f}>{f}</div>
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
