"use client";

import { useCallback, useEffect, useRef, type JSX, type KeyboardEvent } from "react";
import { AnimatePresence } from "framer-motion";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { counterMaxDate, useCounter } from "@/hooks/seva/useCounter";
import { useSevaMe } from "@/hooks/seva/useSevaMe";
import { resolveKey, type KeyZone } from "@/lib/seva/counter/keyboard";
import { ESC_WINDOW_MS, LARGE_CASH_PAISE, matchSevas, type CounterStep } from "@/lib/seva/counter/state";
import { COUNTER_TEXT } from "@/lib/seva/strings/counter";
import { DayClosedNotice } from "./DayClosedNotice";
import { DEVOTEE_FIELD_IDS, DevoteeStep } from "./DevoteeStep";
import { InDoubtDialog } from "./InDoubtDialog";
import { InDoubtNotice } from "./InDoubtNotice";
import { RefusedOutbox } from "./RefusedOutbox";
import { OfflineBanner } from "./OfflineBanner";
import { PayStep } from "./PayStep";
import { PrintedPanel } from "./PrintedPanel";
import { ReceiptSummary } from "./ReceiptSummary";
import { RegisterPrompt } from "./RegisterPrompt";
import { SevasStep } from "./SevasStep";
import { StatusStrip } from "./StatusStrip";
import { StepIndicator } from "./StepIndicator";
import { StepPane } from "./StepPane";
import { TempleHeaderBand } from "./TempleHeaderBand";

const ZONES: readonly KeyZone[] = ["name", "field", "search", "tiles", "pay", "other"];

/** The key zone of the element that has focus: the nearest `data-zone` around it ('other' when none). */
function zoneOf(target: EventTarget | null): KeyZone {
  if (!(target instanceof Element)) return "other";
  const zone = target.closest("[data-zone]")?.getAttribute("data-zone");
  return ZONES.find((z) => z === zone) ?? "other";
}

/** Keys inside a dialog belong to the dialog, never to the order (dialogs render in a portal but bubble here). */
function inDialog(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[role="dialog"],[role="alertdialog"],[data-counter-dialog]') !== null;
}

/**
 * The counter (Design Book 9, counter mockup screens `#counter`, `#counter-sevas`, `#counter-pay`, `#printed`,
 * `#offline`): temple header band, status strip, step indicator, the current step large on the left and the sticky
 * "This receipt" summary on the right. Keyboard first (9.6): Enter moves on, 1-9 on the tiles adds, Ctrl+Enter saves,
 * Alt+1/2/3 jump, Esc twice clears; after printing the cursor is back in Name.
 * Plan A4P-2: the steps slide (StepPane) while focus lands where it always did, the offline strip slides down, the
 * printed panel rises in, and the in-doubt question springs in and out.
 */
export function CounterScreen(): JSX.Element {
  const counter = useCounter();
  const { can } = useSevaMe();
  const { state, dispatch, bootstrap, connection, phase } = counter;

  const nameRef = useRef<HTMLInputElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const focusStep = useCallback((step: CounterStep) => {
    // After the step's markup is on screen.
    requestAnimationFrame(() => {
      if (step === 1) nameRef.current?.focus();
      else if (step === 2) searchRef.current?.focus();
      else (document.getElementById("counter-cash-received") ?? document.getElementById("counter-upi-ref"))?.focus();
    });
  }, []);

  useEffect(() => {
    if (phase === "ready") focusStep(state.step);
  }, [phase, state.step, counter.focusTick, focusStep]);

  const goStep = useCallback(
    (step: CounterStep) => {
      dispatch({ type: "goStep", step });
      focusStep(step);
    },
    [dispatch, focusStep],
  );

  const focusNextField = useCallback(
    (fromId: string) => {
      const i = DEVOTEE_FIELD_IDS.findIndex((id) => id === fromId);
      const next = i >= 0 ? DEVOTEE_FIELD_IDS[i + 1] : undefined;
      if (next) document.getElementById(next)?.focus();
      else goStep(2);
    },
    [goStep],
  );

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.nativeEvent.isComposing || inDialog(e.target) || counter.inDoubt) return;
    // A pick list that already used Enter (picked an option or moved on) has called preventDefault.
    if (e.key === "Enter" && e.defaultPrevented && !e.ctrlKey) return;
    const zone = zoneOf(e.target);
    const result = resolveKey({ key: e.key, ctrlKey: e.ctrlKey || e.metaKey, altKey: e.altKey, zone }, state, Date.now());
    if (!result) return;
    e.preventDefault();
    switch (result.type) {
      case "save":
        void counter.save();
        return;
      case "focusNext":
        focusNextField(e.target instanceof Element ? e.target.id : "");
        return;
      case "goStep":
        goStep(result.step);
        return;
      default: {
        // The second Esc within the window clears the order: the cursor goes back to Name.
        const clears = result.type === "escape" && state.escArmedAt !== null && result.at - state.escArmedAt <= ESC_WINDOW_MS;
        dispatch(result);
        if (clears) focusStep(1);
      }
    }
  }

  if (phase === "loading") {
    return (
      <div role="status" aria-live="polite" className="flex min-h-[40vh] items-center justify-center p-6">
        <Bilingual en={COUNTER_TEXT.loading.en} kn={COUNTER_TEXT.loading.kn} className="text-(--muted-foreground)" />
      </div>
    );
  }

  if (phase === "no_device") return <RegisterPrompt canRegister={can("device.register")} />;

  if (phase === "error" || !bootstrap) {
    return (
      <div role="alert" className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <Bilingual as="h1" en={COUNTER_TEXT.loadFailed.en} kn={COUNTER_TEXT.loadFailed.kn} />
        {counter.loadError ? <p className="m-0 text-(--muted-foreground)">{counter.loadError}</p> : null}
        <Button type="button" variant="seva-primary" onClick={() => void counter.reload()}>
          {COUNTER_TEXT.tryAgain.en}
        </Button>
      </div>
    );
  }

  const offline = connection.status === "offline";
  const totalPaise = counter.groups.ok ? counter.groups.totalPaise : 0;
  const receiptCount = counter.groups.ok ? counter.groups.receipts.length : 0;
  const keysHint = state.step === 1 ? COUNTER_TEXT.keysStep1 : state.step === 2 ? COUNTER_TEXT.keysStep2 : COUNTER_TEXT.keysStep3;
  const excelText =
    counter.excel.failed
      ? COUNTER_TEXT.excelFailed
      : counter.excel.status === "unsupported"
        ? COUNTER_TEXT.excelUnsupported
        : counter.excel.status === "not_set"
          ? COUNTER_TEXT.excelNotSet
          : counter.excel.status === "needs_permission"
            ? COUNTER_TEXT.excelNeedsPermission
            : counter.excel.status === "written"
              ? COUNTER_TEXT.excelWritten
              : COUNTER_TEXT.excelReady;

  return (
    // The key map listens on the whole counter; each control says which zone it is in (data-zone).
    <div className="flex min-h-full flex-col" onKeyDown={handleKeyDown}>
      <TempleHeaderBand slip={bootstrap.slip} />
      <StatusStrip
        counterName={bootstrap.counter.name}
        staffLabel={counter.staffLabel}
        connection={connection}
        nextNumber={counter.nextNumberPreview}
        today={counter.today}
        skewMs={counter.skewMs}
        dayClosed={counter.dayClosed}
        onForcedOffline={counter.setForcedOffline}
      />

      <div className="flex flex-col gap-6 p-8 max-md:p-4">
        {counter.dayClosed ? <DayClosedNotice date={bootstrap.today.businessDate} /> : null}
        {counter.inDoubtOrder ? <InDoubtNotice state={counter.inDoubtOrder} onDismiss={counter.dismissInDoubtOrder} /> : null}
        <RefusedOutbox items={counter.refused} canSetAside={can("gap.resolve")} onSetAside={counter.setAsideRefused} />
        <AnimatePresence initial={false}>
          {offline ? (
            <OfflineBanner
              key="offline"
              since={connection.since}
              waiting={connection.waiting}
              series={bootstrap.counter.offlineSeries}
            />
          ) : null}
        </AnimatePresence>
        {counter.lastPrinted && state.lines.length === 0 && state.devotee.name === "" ? (
          <PrintedPanel
            key={counter.lastPrinted.receipts[0]?.clientReceiptId ?? "printed"}
            receipts={counter.lastPrinted.receipts}
            offline={counter.lastPrinted.offline}
          />
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <StepIndicator step={state.step} onGo={goStep} />
          <p className="m-0 text-(length:--text-meta) text-(--muted-foreground)">{keysHint}</p>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-8 max-lg:grid-cols-1">
          <div className="relative flex flex-col gap-6 rounded-(--radius-surface) border border-(--border) bg-(--card) p-8 shadow-(--shadow-card) max-md:p-5">
            <AnimatePresence mode="popLayout" initial={false}>
              <StepPane key={state.step} className="flex flex-col gap-6">
                {state.step === 1 ? (
                  <DevoteeStep
                    devotee={state.devotee}
                    onDevotee={(patch) => dispatch({ type: "setDevotee", patch })}
                    nameRef={nameRef}
                    onEnterNext={focusNextField}
                    suggestion={counter.suggestion}
                    onUseSuggestion={counter.acceptSuggestion}
                    onRejectSuggestion={counter.rejectSuggestion}
                    filledFrom={counter.filledFrom}
                    onUndo={counter.undoSuggestion}
                    lists={bootstrap.lists}
                    searching={counter.searching}
                  />
                ) : state.step === 2 ? (
                  <SevasStep
                    search={state.search}
                    onSearch={(text) => dispatch({ type: "setSearch", text })}
                    searchRef={searchRef}
                    matches={matchSevas(counter.catalogue, state.search)}
                    lines={state.lines}
                    catalogue={counter.catalogue}
                    today={state.today}
                    maxDate={counterMaxDate(bootstrap, state.today)}
                    festivals={bootstrap.festivalChips}
                    canChangeAmount={can("counter.change_amount")}
                    onAdd={(key) => dispatch({ type: "addByKey", key })}
                    onRemove={(lineKey) => dispatch({ type: "removeLine", lineKey })}
                    onQuantity={(lineKey, quantity) => dispatch({ type: "setQuantity", lineKey, quantity })}
                    onDates={(lineKey, dates) => dispatch({ type: "setDates", lineKey, dates })}
                    onAmount={(lineKey, unitRatePaise, reason) => dispatch({ type: "changeAmount", lineKey, unitRatePaise, reason })}
                    onBack={() => goStep(1)}
                  />
                ) : (
                  <>
                    <PayStep
                      totalPaise={totalPaise}
                      receiptCount={receiptCount}
                      payment={state.payment}
                      onPayment={(patch) => dispatch({ type: "setPayment", patch })}
                      upi={bootstrap.upi}
                      upiDisabledReason={bootstrap.upiDisabledReason}
                      upiNote={`Seva ${bootstrap.counter.name}`}
                      largeCash={{
                        required: totalPaise >= LARGE_CASH_PAISE,
                        confirmed: state.confirmLargeCash,
                        onConfirm: () => dispatch({ type: "confirmLargeCash" }),
                      }}
                    />
                    <div className="flex items-center justify-between gap-4 border-t border-(--border) pt-5">
                      <Button type="button" variant="seva-secondary" onClick={() => goStep(2)}>
                        {COUNTER_TEXT.back.en}
                      </Button>
                      <span className="meta">{COUNTER_TEXT.stepOf(3)}</span>
                    </div>
                  </>
                )}
              </StepPane>
            </AnimatePresence>
          </div>

          <ReceiptSummary
            devotee={state.devotee}
            groups={counter.groups}
            catalogue={counter.catalogue}
            step={state.step}
            canSave={counter.canSave}
            submitting={state.submitting}
            onNext={() => goStep(state.step === 1 ? 2 : 3)}
            onSave={counter.save}
            message={counter.message}
            saveDisabled={counter.dayClosed}
          />
        </div>

        <section
          aria-label={COUNTER_TEXT.excelTitle.en}
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-(--radius-control) border border-(--border) bg-(--card) px-5 py-3"
        >
          <Bilingual en={COUNTER_TEXT.excelTitle.en} kn={COUNTER_TEXT.excelTitle.kn} className="font-semibold" />
          {counter.excel.folderName ? <span className="num text-(length:--text-ui)">{counter.excel.folderName}</span> : null}
          <span className="meta" role="status">
            {excelText}
          </span>
          <span className="grow" />
          {counter.excel.status === "needs_permission" ? (
            <Button type="button" variant="seva-secondary" size="sm" onClick={() => void counter.excel.allow()}>
              {COUNTER_TEXT.allowSaving.en}
            </Button>
          ) : null}
          {counter.excel.status !== "unsupported" ? (
            <Button type="button" variant="seva-ghost" size="sm" onClick={() => void counter.excel.choose()}>
              {COUNTER_TEXT.chooseFolder.en}
            </Button>
          ) : null}
          {counter.excel.status === "ready" || counter.excel.status === "written" ? (
            <Button type="button" variant="seva-secondary" size="sm" onClick={() => void counter.excel.saveNow()}>
              {COUNTER_TEXT.saveExcelNow.en}
            </Button>
          ) : null}
          <Button type="button" variant="seva-secondary" size="sm" onClick={() => void counter.excel.download()}>
            {COUNTER_TEXT.downloadExcel.en}
          </Button>
        </section>
      </div>

      <InDoubtDialog open={counter.inDoubt} onAnswer={counter.answerInDoubt} />
    </div>
  );
}

export default CounterScreen;
