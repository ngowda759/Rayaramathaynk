import "@testing-library/jest-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { SevaDrawer, catalogueToUpsert, type SevaDrawerApi } from "@/components/seva/settings/SevaDrawer";
import type { CatalogueSeva } from "@/types/seva";

/**
 * Seva settings drawer (plan A4-9; DB §13.1, C-35, C-38). A rate change shows the old rate and needs a reason; Other
 * Seva / Karnike (an any-amount seva) is always counter-only and takes any amount.
 */

function seva(over: Partial<CatalogueSeva> = {}): CatalogueSeva {
  return {
    id: "00000000-0000-4000-8000-000000000008",
    code: "PL",
    key: 8,
    nameEn: "Pushpalankara",
    nameKn: "ಪುಷ್ಪಾಲಂಕಾರ",
    ratePaise: 100500,
    multiDate: true,
    allowAmountChange: false,
    prasadamGiven: true,
    prasadamItems: "Flowers, phala-mantrakshate",
    visibility: "both",
    active: true,
    category: "Pooja",
    incomeLedger: null,
    ...over,
  };
}

const KARNIKE = seva({
  id: "00000000-0000-4000-8000-000000000014",
  code: "OS",
  key: 14,
  nameEn: "Other Seva / Karnike",
  nameKn: "ಇತರೆ ಸೇವೆ / ಕಾಣಿಕೆ",
  ratePaise: null,
  multiDate: false,
  prasadamGiven: false,
  prasadamItems: null,
  visibility: "counter",
  category: "Offering",
});

function fakeApi(): SevaDrawerApi & { save: jest.Mock; history: jest.Mock } {
  return {
    save: jest.fn().mockResolvedValue({ id: "saved", mirror: "ok" }),
    history: jest.fn().mockResolvedValue([]),
  };
}

function renderDrawer(target: CatalogueSeva | null, api = fakeApi(), readOnly = false, sevas: CatalogueSeva[] = []) {
  const onSaved = jest.fn();
  const onClose = jest.fn();
  render(
    <SevaDrawer seva={target} nextKey={15} sevas={sevas} readOnly={readOnly} api={api} onClose={onClose} onSaved={onSaved} />,
  );
  return { api, onSaved, onClose };
}

// jsdom has no PointerEvent; the Switch primitive (@base-ui/react) creates one when it is clicked.
beforeAll(() => {
  if (typeof window.PointerEvent === "undefined") {
    class PointerEventShim extends MouseEvent {}
    Object.defineProperty(window, "PointerEvent", { value: PointerEventShim, configurable: true, writable: true });
  }
});

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe("Seva drawer", () => {
  it("needs a reason when the rate changes and shows the old rate", async () => {
    const { api, onSaved } = renderDrawer(seva());
    await waitFor(() => expect(api.history).toHaveBeenCalledWith(seva().id));

    // Unchanged rate: no reason asked, no "Was" line.
    expect(screen.queryByLabelText(/Why is the rate changing/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Was Rs 1,005/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Rate/), { target: { value: "1116" } });
    expect(screen.getByText("Was Rs 1,005. Receipts already made keep their rate.")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: /Save changes/ });
    expect(save).toBeDisabled();
    expect(screen.getByText("A reason is needed because the rate changed.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Why is the rate changing/), { target: { value: "Trust board meeting of 22 Mar 2026" } });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(api.save).toHaveBeenCalledTimes(1);
    const [sent, reason] = api.save.mock.calls[0];
    expect(sent).toMatchObject({ id: seva().id, ratePaise: 111600, anyAmount: false, visibility: "both", code: "PL" });
    expect(reason).toBe("Trust board meeting of 22 Mar 2026");
  });

  it("forces Other Seva to counter-only with any amount", async () => {
    // The Other Seva / Karnike row: any amount, counter only, no rate box.
    const first = renderDrawer(KARNIKE);
    await waitFor(() => expect(first.api.history).toHaveBeenCalled());
    expect(screen.getByRole("switch", { name: /Takes any amount/ })).toBeChecked();
    expect(screen.queryByLabelText(/^Rate/)).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^Counter/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /^Online/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /^Both/ })).toBeDisabled();
    cleanup();

    // A fixed-rate seva switched to any amount becomes counter-only and is sent without a rate.
    const { api, onSaved } = renderDrawer(seva());
    fireEvent.click(screen.getByRole("switch", { name: /Takes any amount/ }));
    expect(screen.getByRole("radio", { name: /^Counter/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /^Online/ })).toBeDisabled();
    expect(screen.queryByLabelText(/^Rate/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Save changes/ }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    // The amount-change switch is shown on and locked for any amount, so it is saved on too.
    expect(api.save.mock.calls[0][0]).toMatchObject({ anyAmount: true, ratePaise: null, visibility: "counter", allowAmountChange: true });
    expect(api.save.mock.calls[0][1]).toBeUndefined();
  });

  it("is read-only for view-only temple admins", async () => {
    const { api } = renderDrawer(seva(), fakeApi(), true);
    await waitFor(() => expect(api.history).toHaveBeenCalled());
    expect(screen.getByLabelText(/Name in English/)).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Save changes/ })).not.toBeInTheDocument();
  });

  it("refuses a counter key another seva already uses", async () => {
    const archana = seva({ id: "00000000-0000-4000-8000-000000000007", key: 7, code: "AR", nameEn: "Archana" });
    const { api, onSaved } = renderDrawer(seva(), fakeApi(), false, [seva(), archana]);
    await waitFor(() => expect(api.history).toHaveBeenCalled());
    const keyBox = screen.getByLabelText(/Counter key/);
    fireEvent.change(keyBox, { target: { value: "7" } });
    expect(screen.getByText("Key 7 is used by Archana.")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: /Save changes/ });
    expect(save).toBeDisabled();

    fireEvent.change(keyBox, { target: { value: "9" } });
    expect(screen.queryByText(/is used by/)).not.toBeInTheDocument();
    fireEvent.click(save);
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(api.save.mock.calls[0][0]).toMatchObject({ key: 9 });
  });

  it("sends no key for a seva whose key is unchanged, so a legacy key of 0 still saves", async () => {
    const legacy = seva({ key: 0 });
    // The list's Active switch.
    expect(catalogueToUpsert(legacy)).not.toHaveProperty("key");
    expect(catalogueToUpsert(seva())).not.toHaveProperty("key");

    // The drawer: an untouched legacy 0 shows no key error and saves without a key.
    const { api, onSaved } = renderDrawer(legacy);
    await waitFor(() => expect(api.history).toHaveBeenCalled());
    expect(screen.queryByText("Type a key from 1 to 999.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Save changes/ }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(api.save.mock.calls[0][0]).not.toHaveProperty("key");
  });

  it("sends the key for a new seva", async () => {
    const { api, onSaved } = renderDrawer(null);
    fireEvent.change(screen.getByLabelText(/Name in English/), { target: { value: "Tulasi Archane" } });
    fireEvent.change(screen.getByLabelText(/^Rate/), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add seva/ }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(api.save.mock.calls[0][0]).toMatchObject({ key: 15, nameEn: "Tulasi Archane", ratePaise: 5000 });
  });
});
