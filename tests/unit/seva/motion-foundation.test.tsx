import { useState } from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MotionConfig } from "framer-motion";

import { AnimatedNumber } from "@/components/seva/motion/AnimatedNumber";
import { MotionDialog } from "@/components/seva/motion/MotionDialog";
import { PendingButton } from "@/components/seva/motion/PendingButton";
import { Segmented } from "@/components/seva/ui/Segmented";
import { DialogTitle } from "@/components/ui/dialog";
import { useAsyncAction } from "@/hooks/seva/useAsyncAction";
import { heroOption, modeOption, type HeroInput } from "@/lib/seva/charts/options";
import { MIN_PENDING_MS, PRESS, SPRING, enterVariants, skeletonFor, slideIn, staggerChildren } from "@/lib/seva/motion";

type Rec = Record<string, unknown>;

/** A promise the test settles by hand. */
function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("motion constants", () => {
  it("uses the owner-chosen Lively spring (380/22/1)", () => {
    expect(SPRING).toEqual({ type: "spring", stiffness: 380, damping: 22, mass: 1 });
    expect(PRESS).toEqual({ scale: 0.94, transition: { type: "spring", stiffness: 900, damping: 40 } });
    expect(enterVariants.hidden).toEqual({ opacity: 0, y: 18, scale: 0.96 });
    expect(enterVariants.shown).toEqual({ opacity: 1, y: 0, scale: 1 });
    expect(staggerChildren(0.055).shown).toEqual({ transition: { staggerChildren: 0.055 } });
    expect(slideIn.hidden).toEqual({ opacity: 0, x: 24 });
    expect(slideIn.shown).toEqual({ opacity: 1, x: 0 });
    expect(MIN_PENDING_MS).toBe(300);
  });

  it("maps each seva route to the skeleton shaped like it", () => {
    expect(skeletonFor("/admin/receipts")).toBe("dashboard");
    expect(skeletonFor("/admin/receipts/counter")).toBe("counter");
    expect(skeletonFor("/admin/receipts/counter/today")).toBe("list");
    expect(skeletonFor("/admin/receipts/register?status=changed")).toBe("list");
    expect(skeletonFor("/admin/receipts/settings/receipt")).toBe("form");
    expect(skeletonFor("/admin/receipts/2b1c9a3e-0000-4000-8000-000000000001")).toBe("detail");
    expect(skeletonFor("/admin/prasadam")).toBe("form");
  });
});

describe("useAsyncAction", () => {
  it("is pending at once, ignores a second run while pending, and reports a failure", async () => {
    const gate = deferred();
    const fn = jest.fn(() => gate.promise.then(() => {
      throw new Error("office unreachable");
    }));
    const { result } = renderHook(() => useAsyncAction(fn));
    let first: Promise<unknown> = Promise.resolve();
    act(() => {
      first = result.current.run();
      void result.current.run();
    });
    expect(result.current.pending).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
    await act(async () => {
      gate.resolve();
      await first;
    });
    expect(result.current.pending).toBe(false);
    expect(result.current.error?.message).toBe("office unreachable");
  });
});

describe("PendingButton", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("PendingButton shows the spinner and aria-busy in the same tick as the click and ignores a second click", async () => {
    const gate = deferred();
    const action = jest.fn(() => gate.promise);
    render(
      <PendingButton action={action} pendingLabel="Saving...">
        Save and print
      </PendingButton>,
    );
    const button = screen.getByRole("button", { name: "Save and print" });

    fireEvent.click(button);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.querySelector("[data-spinner]")).not.toBeNull();
    expect(button.textContent).toContain("Saving...");

    fireEvent.click(button);
    expect(action).toHaveBeenCalledTimes(1);

    await act(async () => {
      gate.resolve();
      await gate.promise;
    });
    await waitFor(() => expect(button.getAttribute("aria-busy")).toBeNull());
    expect(button.textContent).toBe("Save and print");
  });

  it("PendingButton keeps the pending state visible for at least 300 ms", async () => {
    jest.useFakeTimers();
    const action = jest.fn(() => Promise.resolve());
    render(
      <PendingButton action={action} pendingLabel="Saving...">
        Save
      </PendingButton>,
    );
    const button = screen.getByRole("button", { name: "Save" });

    fireEvent.click(button);
    // The action answers at once; the pending look must not flicker away.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(MIN_PENDING_MS - 20);
    });
    expect(button.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      jest.advanceTimersByTime(40);
      await Promise.resolve();
    });
    expect(button.getAttribute("aria-busy")).toBeNull();
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("follows a pending flag from a form that owns the request", () => {
    const { rerender } = render(
      <PendingButton type="submit" pending={false} pendingLabel="Saving...">
        Save
      </PendingButton>,
    );
    rerender(
      <PendingButton type="submit" pending pendingLabel="Saving...">
        Save
      </PendingButton>,
    );
    const button = screen.getByRole("button", { name: /Saving/ });
    expect(button.getAttribute("type")).toBe("submit");
    expect(button.getAttribute("aria-busy")).toBe("true");
  });
});

describe("AnimatedNumber", () => {
  it("AnimatedNumber ends exactly on the value and shows it at once under reduced motion", async () => {
    const { container, rerender } = render(<AnimatedNumber value={0} />);
    const shown = () => container.querySelector('[aria-hidden="true"]')?.textContent;
    const spoken = () => container.querySelector(".sr-only")?.textContent;
    expect(container.firstElementChild?.className).toContain("tabular-nums");

    rerender(<AnimatedNumber value={123456} />);
    // Screen readers get the final value only, at once.
    expect(spoken()).toBe("1,23,456");
    await waitFor(() => expect(shown()).toBe("1,23,456"), { timeout: 4000 });

    const reduced = render(
      <MotionConfig reducedMotion="always">
        <AnimatedNumber value={10} format={(n) => `Rs ${n}`} />
      </MotionConfig>,
    );
    reduced.rerender(
      <MotionConfig reducedMotion="always">
        <AnimatedNumber value={5000} format={(n) => `Rs ${n}`} />
      </MotionConfig>,
    );
    expect(reduced.container.querySelector('[aria-hidden="true"]')?.textContent).toBe("Rs 5000");
  });
});

describe("Segmented", () => {
  type Mode = "cash" | "upi" | "online";

  it("Segmented keeps its keyboard behaviour and marks the moving pill", () => {
    const onChange = jest.fn();
    function Harness() {
      const [value, setValue] = useState<Mode>("cash");
      return (
        <Segmented<Mode>
          name="mode"
          label="Payment"
          value={value}
          options={[
            { value: "cash", en: "Cash" },
            { value: "upi", en: "UPI", disabled: true },
            { value: "online", en: "Online" },
          ]}
          onChange={(v) => {
            setValue(v);
            onChange(v);
          }}
        />
      );
    }
    render(<Harness />);
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    const pills = () => document.querySelectorAll("[data-segmented-pill]");
    expect(pills()).toHaveLength(1);
    expect(radios[0].contains(pills()[0])).toBe(true);
    expect(pills()[0].getAttribute("aria-hidden")).toBe("true");

    // The disabled UPI is skipped; the pill moves with the choice.
    fireEvent.keyDown(radios[0], { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("online");
    expect(document.activeElement).toBe(radios[2]);
    expect(pills()).toHaveLength(1);
    expect(radios[2].contains(pills()[0])).toBe(true);

    fireEvent.keyDown(radios[2], { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith("cash");
    expect(radios[0].getAttribute("aria-checked")).toBe("true");
  });
});

describe("MotionDialog", () => {
  it("keeps Escape closing the dialog", () => {
    const onOpenChange = jest.fn();
    render(
      <MotionDialog open onOpenChange={onOpenChange}>
        <DialogTitle variant="seva">Cancel receipt</DialogTitle>
      </MotionDialog>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Cancel receipt");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalled();
    expect(onOpenChange.mock.calls[0][0]).toBe(false);
  });
});

describe("chart motion", () => {
  const HERO: HeroInput = {
    buckets: [{ key: "09", label: "09:00", cashPaise: 10_000, upiPaise: 5_000, onlinePaise: 0 }],
    prev: [{ key: "09", totalPaise: 9_000 }],
  };
  const COLORS = ["rgb(201, 150, 40)", "rgb(180, 100, 50)", "rgb(40, 140, 90)", "rgb(60, 100, 170)"];

  it("bar charts animate with backOut and turn animation off under reduced motion", () => {
    const option = heroOption(HERO, { colors: COLORS, reducedMotion: false }) as unknown as Rec;
    expect(option.animation).toBe(true);
    expect(option.animationDurationUpdate).toBe(500);
    expect(option.animationEasingUpdate).toBe("cubicInOut");
    const series = option.series as Rec[];
    const bars = series.filter((s) => s.type === "bar");
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) {
      expect(bar.animationEasing).toBe("backOut");
      expect(bar.animationDuration).toBe(700);
      expect((bar.animationDelay as (i: number) => number)(3)).toBe(90);
    }
    const line = series.find((s) => s.type === "line");
    expect(line?.animationEasing).toBe("cubicOut");

    const pie = (modeOption({ cashPaise: 1, upiPaise: 1, onlinePaise: 0 }, "today", { colors: COLORS, reducedMotion: false }) as unknown as Rec)
      .series as Rec[];
    expect(pie[0].animationEasing).toBe("cubicOut");

    const reduced = heroOption(HERO, { colors: COLORS, reducedMotion: true }) as unknown as Rec;
    expect(reduced.animation).toBe(false);
  });
});
