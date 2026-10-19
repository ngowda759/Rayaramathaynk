"use client";

import { useState, type JSX, type ReactNode } from "react";
import { m } from "framer-motion";
import { Check } from "lucide-react";

import { PendingButton } from "@/components/seva/motion/PendingButton";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { enterVariants } from "@/lib/seva/motion";
import type { Bi } from "@/lib/seva/strings/common";
import { formatIstTime, PRASADAM } from "@/lib/seva/strings/prasadam";
import { businessDate, formatSevaDate } from "@/lib/seva/time";
import type { PrasadamLookupResult, PrasadamReceipt } from "@/types/seva-prasadam";

import { ChooseReceipt } from "./ChooseReceipt";

export interface ResultCardProps {
  result: PrasadamLookupResult;
  /** Today's IST business date ('YYYY-MM-DD'); defaults to now. */
  today?: string;
  /** A request is running: every action waits. */
  busy?: boolean;
  /** The caller's own give may still be undone (same person, 120 s; C-27). */
  undoOpen?: boolean;
  onMarkGiven(): void;
  /** Sent only on the second tap of "Give anyway" (D35). */
  onGiveAnyway(): void;
  onNotNow(): void;
  onScanNext(): void;
  onUndo(): void;
  onChoose(receiptNo: string): void;
  onTypeAgain(): void;
  onScanInstead(): void;
}

type Tone = "ok" | "attn" | "crit" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  ok: "bg-(--ok-soft) border-[color-mix(in_oklab,var(--ok)_40%,transparent)]",
  attn: "bg-(--attn-soft) border-[color-mix(in_oklab,var(--primary-press)_45%,transparent)]",
  crit: "bg-(--destructive-soft) border-[color-mix(in_oklab,var(--destructive)_40%,transparent)]",
  neutral: "bg-(--card) border-(--border)",
};

const TITLE_CLASS: Record<Tone, string> = {
  ok: "text-(--ok)",
  attn: "text-(--foreground)",
  crit: "text-(--destructive)",
  neutral: "text-(--foreground)",
};

const BIG = "h-14 w-full text-(length:--text-body-lg)";

/** The action whose request is running, so only the tapped button says it is working (plan A4P-4). */
type Tapped = "give" | "giveAnyway" | "undo";

/** Each answer springs in already in its state colour (plan A4P-4); the page keys the card per answer. */
function Card({ state, tone, children }: { state: string; tone: Tone; children: ReactNode }): JSX.Element {
  return (
    <m.section
      data-testid="prasadam-result"
      data-state={state}
      data-tone={tone}
      variants={enterVariants}
      initial="hidden"
      animate="shown"
      className={`flex flex-col gap-4 rounded-(--radius-surface) border p-5 shadow-(--shadow-card) ${TONE_CLASS[tone]}`}
    >
      {children}
    </m.section>
  );
}

function Title({ tone, en, kn }: { tone: Tone; en: string; kn: string }): JSX.Element {
  return <Bilingual as="h2" en={en} kn={kn} className={`text-(length:--text-h2) leading-tight font-bold ${TITLE_CLASS[tone]}`} />;
}

function Meta({ children }: { children: ReactNode }): JSX.Element {
  return <p className="text-(length:--text-meta) text-(--muted-foreground)">{children}</p>;
}

/** Devotee name, receipt number (and when it was made) and the group line. */
function Who({ receipt, showMade = false }: { receipt: PrasadamReceipt; showMade?: boolean }): JSX.Element {
  return (
    <div>
      <strong className="text-(length:--text-body-lg)">{receipt.devoteeName}</strong>
      <Meta>
        <span className="tabular-nums">{receipt.receiptNo}</span>
        {showMade ? ` · ${PRASADAM.made(formatIstTime(receipt.issuedAt))}` : null}
      </Meta>
      {receipt.groupLine ? <Meta>{receipt.groupLine}</Meta> : null}
    </div>
  );
}

/** What to hand over, line by line, Kannada under each seva. Never an amount. */
function GiveLines({ receipt }: { receipt: PrasadamReceipt }): JSX.Element {
  return (
    <ul className="flex flex-col gap-2">
      {receipt.lines.map((line, i) => (
        <li key={`${line.nameEn}-${i}`} className="rounded-(--radius-control) bg-(--card) px-4 py-3">
          <Bilingual as="div" en={`${line.nameEn} × ${line.quantity}`} kn={line.nameKn} />
          {line.prasadamItems ? (
            <p className="mt-1 text-(length:--text-body-lg) font-semibold">{line.prasadamItems}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * A card action. Every action waits while a request runs (`disabled`); the one that started it (`pending`) shows a
 * spinner and its pending words at once, with aria-busy (PendingButton).
 */
function ActionButton({
  label,
  onClick,
  disabled,
  pending = false,
  pendingLabel = label,
  variant = "seva-primary",
  big = false,
}: {
  label: Bi;
  onClick(): void;
  disabled: boolean;
  pending?: boolean;
  pendingLabel?: Bi;
  variant?: "seva-primary" | "seva-ghost" | "seva-secondary";
  big?: boolean;
}): JSX.Element {
  return (
    <PendingButton
      variant={variant}
      disabled={disabled}
      pending={pending}
      pendingLabel={<Bilingual en={pendingLabel.en} kn={pendingLabel.kn} />}
      data-action={label.en}
      onClick={onClick}
      className={`${pending ? "gap-2" : "flex-col gap-0"} ${big ? BIG : "h-12 w-full"}`}
    >
      <Bilingual en={label.en} kn={label.kn} />
    </PendingButton>
  );
}

function lastDigits(receiptNo: string): string {
  const tail = receiptNo.split("/").pop() ?? receiptNo;
  return tail;
}

/** "Give anyway" for a slip of another day: the first tap arms it, the second gives (D35). */
function GiveAnyway({ busy, pending, onGiveAnyway }: { busy: boolean; pending: boolean; onGiveAnyway(): void }): JSX.Element {
  const [armed, setArmed] = useState(false);
  return (
    <ActionButton
      label={armed ? PRASADAM.giveAnywayConfirm : PRASADAM.giveAnyway}
      pendingLabel={PRASADAM.giving}
      variant={armed ? "seva-primary" : "seva-secondary"}
      disabled={busy}
      pending={pending}
      big={armed}
      onClick={() => {
        if (armed) onGiveAnyway();
        else setArmed(true);
      }}
    />
  );
}

/** The tick on "Marked given": it pops in once, a moment after the card. */
function Tick(): JSX.Element {
  return (
    <m.span
      data-tick=""
      aria-hidden="true"
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 16, delay: 0.08 }}
      className="grid size-9 shrink-0 place-items-center rounded-full bg-(--ok-soft) text-(--ok) ring-2 ring-(--ok)"
    >
      <Check className="size-5" strokeWidth={3} />
    </m.span>
  );
}

/**
 * The answer to a prasadam lookup or give (DB §11): green ready, amber another day, "Marked given" with Undo on the
 * caller's own give (`givenNow`), amber already given (who and when, no Undo), red cancelled, no prasadam, the pick
 * list for an ambiguous short number, and not found. No amounts in any state.
 */
export function ResultCard(props: ResultCardProps): JSX.Element {
  const { result, busy = false, undoOpen = false } = props;
  const today = props.today ?? businessDate(new Date());
  const [tapped, setTapped] = useState<Tapped | null>(null);
  const working = (action: Tapped): boolean => busy && tapped === action;

  switch (result.state) {
    case "ready":
      return (
        <Card state="ready" tone="ok">
          <div>
            <Title tone="ok" en={PRASADAM.giveTitle.en} kn={PRASADAM.giveTitle.kn} />
            <Meta>{PRASADAM.sevaDateToday(formatSevaDate(result.receipt.sevaDate)).en}</Meta>
          </div>
          <Who receipt={result.receipt} showMade />
          <GiveLines receipt={result.receipt} />
          <div className="flex flex-col gap-2">
            <ActionButton
              label={PRASADAM.markGiven}
              pendingLabel={PRASADAM.giving}
              onClick={() => {
                setTapped("give");
                props.onMarkGiven();
              }}
              disabled={busy}
              pending={working("give")}
              big
            />
            <ActionButton label={PRASADAM.notNow} onClick={props.onNotNow} disabled={busy} variant="seva-ghost" />
          </div>
        </Card>
      );

    case "another_day": {
      const date = formatSevaDate(result.receipt.sevaDate);
      const slip = result.todaysSlip;
      return (
        <Card state="another_day" tone="attn">
          <Title tone="attn" en={PRASADAM.notToday.en} kn={PRASADAM.notToday.kn} />
          {result.offDate === "before" ? (
            <div>
              <Bilingual as="div" en={PRASADAM.prasadamIsFor.en} kn={PRASADAM.prasadamIsFor.kn} />
              <p className="text-(length:--text-h1) leading-tight font-bold tracking-tight">
                {date} <span className="text-(length:--text-body) font-semibold">- {PRASADAM.notTodaySuffix.en}</span>
              </p>
            </div>
          ) : (
            <Bilingual
              as="div"
              en={PRASADAM.sevaWasOn(date, result.days).en}
              kn={PRASADAM.sevaWasOn(date, result.days).kn}
              className="text-(length:--text-body-lg) font-semibold"
            />
          )}
          <Who receipt={result.receipt} />
          <GiveLines receipt={result.receipt} />
          {slip ? (
            <Bilingual
              as="div"
              en={PRASADAM.todaysSlip(slip.position, slip.count, lastDigits(slip.receiptNo)).en}
              kn={PRASADAM.todaysSlip(slip.position, slip.count, lastDigits(slip.receiptNo)).kn}
            />
          ) : null}
          <div className="flex flex-col gap-2">
            <ActionButton label={PRASADAM.scanNext} onClick={props.onScanNext} disabled={busy} big />
            <GiveAnyway
              busy={busy}
              pending={working("giveAnyway")}
              onGiveAnyway={() => {
                setTapped("giveAnyway");
                props.onGiveAnyway();
              }}
            />
          </div>
        </Card>
      );
    }

    case "already_given": {
      const time = formatIstTime(result.givenAt);
      if (result.givenNow === true) {
        return (
          <Card state="marked" tone="ok">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <Tick />
                <div className="min-w-0">
                  <Bilingual
                    as="div"
                    en={PRASADAM.markedGiven(time).en}
                    kn={PRASADAM.markedGiven(time).kn}
                    className="font-bold text-(--ok)"
                  />
                  <Meta>
                    <span className="tabular-nums">
                      {result.receipt.devoteeName} · {result.receipt.receiptNo}
                    </span>
                  </Meta>
                </div>
              </div>
              {undoOpen ? (
                <PendingButton
                  variant="seva-secondary"
                  size="sm"
                  disabled={busy}
                  pending={working("undo")}
                  pendingLabel={<Bilingual en={PRASADAM.undoing.en} kn={PRASADAM.undoing.kn} />}
                  data-action={PRASADAM.undo.en}
                  onClick={() => {
                    setTapped("undo");
                    props.onUndo();
                  }}
                  className={`h-auto min-h-11 shrink-0 py-1.5 ${working("undo") ? "gap-2" : "flex-col gap-0"}`}
                >
                  <Bilingual en={PRASADAM.undo.en} kn={PRASADAM.undo.kn} />
                </PendingButton>
              ) : null}
            </div>
          </Card>
        );
      }
      const givenDay = businessDate(new Date(result.givenAt));
      const line =
        Number.isNaN(new Date(result.givenAt).getTime()) || givenDay === today
          ? PRASADAM.givenAtBy(time, result.givenBy)
          : PRASADAM.givenOnAtBy(formatSevaDate(givenDay), time, result.givenBy);
      return (
        <Card state="already_given" tone="attn">
          <Title tone="attn" en={PRASADAM.alreadyGiven.en} kn={PRASADAM.alreadyGiven.kn} />
          <Bilingual as="div" en={line.en} kn={line.kn} className="text-(length:--text-body-lg) font-semibold" />
          <Who receipt={result.receipt} />
          <Bilingual as="div" en={PRASADAM.doNotGiveAgain.en} kn={PRASADAM.doNotGiveAgain.kn} className="text-(--muted-foreground)" />
          <ActionButton label={PRASADAM.scanNext} onClick={props.onScanNext} disabled={busy} big />
        </Card>
      );
    }

    case "cancelled": {
      const by = PRASADAM.cancelledAtBy(formatIstTime(result.cancelledAt), result.cancelledBy);
      return (
        <Card state="cancelled" tone="crit">
          <Title tone="crit" en={PRASADAM.cancelledTitle.en} kn={PRASADAM.cancelledTitle.kn} />
          <div>
            <strong className="text-(length:--text-body-lg)">{result.receipt.devoteeName}</strong>
            <Meta>
              <span className="tabular-nums">{result.receipt.receiptNo}</span>
            </Meta>
            <Bilingual as="div" en={by.en} kn={by.kn} className="text-(length:--text-meta) text-(--muted-foreground)" />
          </div>
          {result.reason ? (
            <Bilingual as="div" en={PRASADAM.cancelledReason(result.reason).en} kn={PRASADAM.cancelledReason(result.reason).kn} />
          ) : null}
          <Bilingual as="div" en={PRASADAM.newerSlip.en} kn={PRASADAM.newerSlip.kn} />
          <Bilingual as="div" en={PRASADAM.doNotGiveCancelled.en} kn={PRASADAM.doNotGiveCancelled.kn} className="font-semibold" />
          <ActionButton label={PRASADAM.scanNext} onClick={props.onScanNext} disabled={busy} big />
        </Card>
      );
    }

    case "no_prasadam":
      return (
        <Card state="no_prasadam" tone="neutral">
          <Title tone="neutral" en={PRASADAM.noPrasadamTitle.en} kn={PRASADAM.noPrasadamTitle.kn} />
          <Bilingual as="div" en={PRASADAM.noPrasadam.en} kn={PRASADAM.noPrasadam.kn} className="text-(length:--text-body-lg)" />
          <Who receipt={result.receipt} />
          <ActionButton label={PRASADAM.scanNext} onClick={props.onScanNext} disabled={busy} big />
        </Card>
      );

    case "choose":
      return (
        <Card state="choose" tone="neutral">
          <ChooseReceipt options={result.options} disabled={busy} onChoose={props.onChoose} />
        </Card>
      );

    case "not_found":
      return (
        <Card state="not_found" tone="neutral">
          <Title tone="neutral" en={PRASADAM.notFoundTitle.en} kn={PRASADAM.notFoundTitle.kn} />
          <div>
            <p>
              {PRASADAM.nothingMatches.en} <strong className="break-all tabular-nums">{result.query}</strong>.
            </p>
            <span className="kn" lang="kn">
              {PRASADAM.nothingMatches.kn}
            </span>
          </div>
          <Bilingual as="div" en={PRASADAM.notFoundHint.en} kn={PRASADAM.notFoundHint.kn} className="text-(--muted-foreground)" />
          <div className="flex flex-col gap-2">
            <ActionButton label={PRASADAM.typeAgain} onClick={props.onTypeAgain} disabled={busy} big />
            <ActionButton label={PRASADAM.scanInstead} onClick={props.onScanInstead} disabled={busy} variant="seva-ghost" />
          </div>
        </Card>
      );
  }
}

export default ResultCard;
