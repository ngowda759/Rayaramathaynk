import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { SearchSelect, type SearchOption } from "@/components/seva/ui/SearchSelect";
import { Segmented } from "@/components/seva/ui/Segmented";
import { Button, buttonVariants } from "@/components/ui/button";

type Picked = { value?: string; text: string } | null;

const NAKSHATRAS: readonly SearchOption[] = [
  { value: "1", en: "Ashwini", kn: "ಅಶ್ವಿನಿ" },
  { value: "2", en: "Bharani", kn: "ಭರಣಿ" },
  { value: "3", en: "Krittika", kn: "ಕೃತ್ತಿಕಾ", aliases: ["Krithika", "Kruthika"] },
  { value: "4", en: "Rohini", kn: "ರೋಹಿಣಿ" },
];

const GOTRAS: readonly SearchOption[] = [
  { value: "bharadwaja", en: "Bharadwaja", kn: "ಭಾರದ್ವಾಜ" },
  { value: "kashyapa", en: "Kashyapa", kn: "ಕಾಶ್ಯಪ" },
];

function Harness(props: {
  options: readonly SearchOption[];
  allowTyped?: boolean;
  onChange: (v: Picked) => void;
  onEnterNext?: () => void;
}) {
  const [value, setValue] = useState<Picked>(null);
  return (
    <SearchSelect
      id="field"
      label={{ en: "Field", kn: "ಕ್ಷೇತ್ರ" }}
      options={props.options}
      value={value}
      allowTyped={props.allowTyped}
      onEnterNext={props.onEnterNext}
      onChange={(v) => {
        setValue(v);
        props.onChange(v);
      }}
    />
  );
}

function optionTexts(): string[] {
  return screen.queryAllByRole("option").map((o) => o.textContent ?? "");
}

describe("Bilingual", () => {
  it('Bilingual puts Kannada after English with lang="kn"', () => {
    const { container } = render(<Bilingual en="Gotra" kn="ಗೋತ್ರ" />);
    const text = container.textContent ?? "";
    expect(text.indexOf("Gotra")).toBe(0);
    expect(text.indexOf("ಗೋತ್ರ")).toBeGreaterThan(text.indexOf("Gotra"));
    const kn = container.querySelector('[lang="kn"]');
    expect(kn?.textContent).toBe("ಗೋತ್ರ");
    expect(kn?.classList.contains("kn")).toBe(true);
  });

  it("renders no Kannada line when kn is empty and wires a label", () => {
    const { container } = render(<Bilingual as="label" htmlFor="x" en="Name" kn="" />);
    expect(container.querySelector('[lang="kn"]')).toBeNull();
    expect(container.querySelector("label")?.getAttribute("for")).toBe("x");
  });
});

describe("SearchSelect", () => {
  it("SearchSelect finds by prefix and alias and picks with the keyboard", () => {
    const onChange = jest.fn();
    render(<Harness options={NAKSHATRAS} onChange={onChange} />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "roh" } });
    expect(optionTexts()).toEqual(["Rohiniರೋಹಿಣಿ"]);

    fireEvent.change(input, { target: { value: "krith" } });
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(optionTexts()).toEqual(["Krittikaಕೃತ್ತಿಕಾ"]);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe(screen.getByRole("option").id);
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenLastCalledWith({ value: "3", text: "Krittika" });
    expect((input as HTMLInputElement).value).toBe("Krittika");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("SearchSelect offers the typed text when allowTyped", () => {
    const onChange = jest.fn();
    render(<Harness options={GOTRAS} allowTyped onChange={onChange} />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "Kashyapa Rishi" } });
    const texts = optionTexts();
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain("Kashyapa Rishi");
    expect(texts[0]).toContain("as entered");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith({ text: "Kashyapa Rishi" });
  });

  it("SearchSelect does not offer typed text without allowTyped", () => {
    const onChange = jest.fn();
    render(<Harness options={GOTRAS} onChange={onChange} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Kashyapa Rishi" } });
    expect(optionTexts()).toEqual([]);
  });

  it("SearchSelect closes on Escape and calls onEnterNext after a pick", () => {
    const onChange = jest.fn();
    const onEnterNext = jest.fn();
    render(<Harness options={GOTRAS} onChange={onChange} onEnterNext={onEnterNext} />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "b" } });
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(onEnterNext).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "bha" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith({ value: "bharadwaja", text: "Bharadwaja" });
    expect(onEnterNext).toHaveBeenCalledTimes(1);
  });

  it("SearchSelect keeps the Enter pick when onEnterNext moves focus (allowTyped)", () => {
    const onChange = jest.fn();
    function FocusHarness() {
      const [value, setValue] = useState<Picked>(null);
      return (
        <>
          <SearchSelect
            id="gotra"
            label={{ en: "Gotra", kn: "ಗೋತ್ರ" }}
            options={GOTRAS}
            value={value}
            allowTyped
            onEnterNext={() => document.getElementById("next")?.focus()}
            onChange={(v) => {
              setValue(v);
              onChange(v);
            }}
          />
          <input id="next" aria-label="Next" />
          <output data-testid="parent">{JSON.stringify(value)}</output>
        </>
      );
    }
    render(<FocusHarness />);
    const input = screen.getByRole("combobox");
    act(() => input.focus());

    fireEvent.change(input, { target: { value: "kash" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(document.activeElement?.id).toBe("next");
    expect(onChange).toHaveBeenLastCalledWith({ value: "kashyapa", text: "Kashyapa" });
    expect(JSON.parse(screen.getByTestId("parent").textContent ?? "null")).toEqual({
      value: "kashyapa",
      text: "Kashyapa",
    });
    expect((input as HTMLInputElement).value).toBe("Kashyapa");
  });

  it("SearchSelect takes custom wording for the typed option and hint", () => {
    function TextHarness() {
      const [value, setValue] = useState<Picked>(null);
      return (
        <SearchSelect
          id="g2"
          label={{ en: "Gotra" }}
          options={GOTRAS}
          value={value}
          allowTyped
          onChange={setValue}
          typedOptionLabel={(t) => `Keep ${t}`}
          typedHint="Typed by hand"
        />
      );
    }
    render(<TextHarness />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Atri" } });
    expect(optionTexts()).toEqual(["Keep Atri"]);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("Typed by hand")).toBeTruthy();
  });
});

describe("Segmented", () => {
  type Period = "today" | "week" | "month";
  function SegHarness({ onChange }: { onChange: (v: Period) => void }) {
    const [value, setValue] = useState<Period>("today");
    return (
      <Segmented<Period>
        name="period"
        label="Period"
        value={value}
        options={[
          { value: "today", en: "Today", kn: "ಇಂದು" },
          { value: "week", en: "Week" },
          { value: "month", en: "Month" },
        ]}
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
      />
    );
  }

  it("Segmented moves with arrow keys and reports the value", () => {
    const onChange = jest.fn();
    render(<SegHarness onChange={onChange} />);
    expect(screen.getByRole("radiogroup").getAttribute("aria-label")).toBe("Period");
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);

    fireEvent.keyDown(radios[0], { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("week");
    expect(document.activeElement).toBe(radios[1]);
    expect(radios[1].getAttribute("aria-checked")).toBe("true");

    fireEvent.keyDown(radios[1], { key: "ArrowLeft" });
    fireEvent.keyDown(radios[0], { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("month");
    expect(document.activeElement).toBe(radios[2]);
  });
});

describe("Button", () => {
  // Captured from components/ui/button.tsx before the seva variants were added.
  const DEFAULT_BEFORE =
    "inline-flex items-center justify-center font-medium transition disabled:opacity-50 disabled:cursor-not-allowed bg-orange-600 hover:bg-orange-700 text-white h-11 rounded-lg px-4 py-3";
  const OUTLINE_SM_BEFORE =
    "inline-flex items-center justify-center font-medium transition disabled:opacity-50 disabled:cursor-not-allowed border border-orange-600 text-orange-600 hover:bg-orange-50 h-9 rounded-md px-3 py-2 text-sm";

  it("keeps the default button classes unchanged", () => {
    expect(buttonVariants()).toBe(DEFAULT_BEFORE);
    expect(buttonVariants({ variant: "outline", size: "sm" })).toBe(OUTLINE_SM_BEFORE);
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" }).className).toBe(DEFAULT_BEFORE);
  });

  it("adds the seva variants on module tokens", () => {
    render(<Button variant="seva-primary">Issue</Button>);
    const cls = screen.getByRole("button", { name: "Issue" }).className;
    expect(cls).toContain("bg-(--primary)");
    expect(cls).toContain("text-(--primary-ink)");
    expect(cls).not.toContain("bg-orange-600");
  });
});
