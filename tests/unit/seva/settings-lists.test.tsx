import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { DevoteeStep } from "@/components/seva/counter/DevoteeStep";
import { DevoteeListsEditor } from "@/components/seva/settings/lists/DevoteeListsEditor";
import type { ListItemSaveRequest } from "@/lib/seva/schemas";
import type { SevaListItem, SevaListKind, SevaLists } from "@/types/seva";

/** Settings - Devotee lists (plan A4P-5): the editor's add, hide and Kannada-only flows, and the counter's pickers. */

function item(p: Partial<SevaListItem> & Pick<SevaListItem, "id" | "nameEn">): SevaListItem {
  return { nameKn: null, knChecked: false, active: true, displayOrder: p.id, ...p };
}

function lists(): SevaLists {
  return {
    gotras: [item({ id: 1, nameEn: "Kashyapa", nameKn: "ಕಾಶ್ಯಪ" }), item({ id: 12, nameEn: "Shandilya", nameKn: "ಶಾಂಡಿಲ್ಯ" })],
    nakshatras: [item({ id: 25, nameEn: "Purva Bhadrapada", nameKn: "ಪೂರ್ವಾಭಾದ್ರ" })],
    rashis: [item({ id: 1, nameEn: "Mesha", nameKn: "ಮೇಷ", knChecked: true })],
  };
}

/** A fake POST /api/seva/settings/lists over a copy of the lists. */
function fakeSave(data: SevaLists) {
  return jest.fn(async (input: ListItemSaveRequest): Promise<{ kind: SevaListKind; item: SevaListItem }> => {
    if (input.kind === "gotra" && input.id === undefined) {
      const added = item({ id: 1000, nameEn: input.nameEn ?? "", nameKn: input.nameKn ?? null, knChecked: input.nameKn !== undefined, displayOrder: 99 });
      data.gotras.push(added);
      return { kind: "gotra", item: added };
    }
    const list = input.kind === "gotra" ? data.gotras : input.kind === "nakshatra" ? data.nakshatras : data.rashis;
    const found = list.find((i) => i.id === input.id);
    if (!found) throw new Error("not found");
    const next: SevaListItem = { ...found };
    if (input.kind === "gotra" && input.active !== undefined) next.active = input.active;
    if (input.nameKn !== undefined) Object.assign(next, { nameKn: input.nameKn, knChecked: true });
    return { kind: input.kind, item: next };
  });
}

afterEach(cleanup);

describe("Settings - Devotee lists", () => {
  it("adds a gotra, hides one and corrects a nakshatra's Kannada, with a count of unchecked names per tab", async () => {
    const save = fakeSave(lists());
    render(<DevoteeListsEditor lists={lists()} editable onSave={save} />);

    expect(screen.getByTestId("unchecked-count-gotra")).toHaveTextContent("2");
    expect(screen.getByTestId("unchecked-count-rashi")).toHaveTextContent("0");

    fireEvent.click(screen.getByRole("button", { name: /Add gotra/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/English name/), { target: { value: " Vyaghrapada " } });
    fireEvent.change(within(dialog).getByLabelText(/Kannada name/), { target: { value: "ವ್ಯಾಘ್ರಪಾದ" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: /^Save/ }));
    });
    await waitFor(() => expect(save).toHaveBeenCalledWith({ kind: "gotra", nameEn: "Vyaghrapada", nameKn: "ವ್ಯಾಘ್ರಪಾದ" }));
    expect(await screen.findByRole("row", { name: /Vyaghrapada/ })).toBeInTheDocument();
    // An admin-saved Kannada name is checked, so the count does not grow.
    expect(screen.getByTestId("unchecked-count-gotra")).toHaveTextContent("2");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Hide Shandilya" }));
    });
    expect(await screen.findByRole("button", { name: "Show Shandilya" })).toBeInTheDocument();
    expect(save).toHaveBeenLastCalledWith({ kind: "gotra", id: 12, active: false });

    fireEvent.click(screen.getByRole("tab", { name: /^Nakshatra/ }));
    expect(screen.getByRole("tab", { name: /^Nakshatra/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("button", { name: /Add gotra/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit Kannada of Purva Bhadrapada" }));
    const edit = await screen.findByRole("dialog");
    expect(within(edit).queryByLabelText(/English name/)).toBeNull();
    fireEvent.change(within(edit).getByLabelText(/Kannada name/), { target: { value: "ಪೂರ್ವಾಭಾದ್ರಪದ" } });
    await act(async () => {
      fireEvent.click(within(edit).getByRole("button", { name: /^Save/ }));
    });
    await waitFor(() => expect(save).toHaveBeenLastCalledWith({ kind: "nakshatra", id: 25, nameKn: "ಪೂರ್ವಾಭಾದ್ರಪದ" }));
    await waitFor(() => expect(screen.getByTestId("unchecked-count-nakshatra")).toHaveTextContent("0"));
  });

  it("refuses a duplicate gotra name before saving", async () => {
    const save = fakeSave(lists());
    render(<DevoteeListsEditor lists={lists()} editable onSave={save} />);
    fireEvent.click(screen.getByRole("button", { name: /Add gotra/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/English name/), { target: { value: "KASHYAPA" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^Save/ }));
    expect(await within(dialog).findByText(/already in the list/)).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it("shows a view-only temple admin the lists with nothing to change", () => {
    render(<DevoteeListsEditor lists={lists()} editable={false} onSave={jest.fn()} />);
    expect(screen.getByRole("row", { name: /Kashyapa/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add gotra/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Hide / })).toBeNull();
    expect(screen.getByText(/view-only/)).toBeInTheDocument();
  });

  it("the counter's gotra picker offers an added gotra and leaves out a hidden one", () => {
    const data = lists();
    data.gotras.push(item({ id: 1000, nameEn: "Vyaghrapada", nameKn: "ವ್ಯಾಘ್ರಪಾದ" }));
    data.gotras[1].active = false;
    render(
      <DevoteeStep
        devotee={{ name: "", gotra: null, nakshatra: null, rashi: null, phone: "" }}
        onDevotee={jest.fn()}
        nameRef={{ current: null }}
        onEnterNext={jest.fn()}
        suggestion={null}
        onUseSuggestion={jest.fn()}
        onRejectSuggestion={jest.fn()}
        filledFrom={null}
        onUndo={jest.fn()}
        lists={data}
      />,
    );
    const gotra = screen.getByRole("combobox", { name: /Gotra/ });
    fireEvent.focus(gotra);
    const options = screen.getAllByRole("option").map((o) => o.textContent ?? "");
    expect(options.some((t) => t.includes("Vyaghrapada") && t.includes("ವ್ಯಾಘ್ರಪಾದ"))).toBe(true);
    expect(options.some((t) => t.includes("Shandilya"))).toBe(false);
    expect(options.some((t) => t.includes("Kashyapa"))).toBe(true);
  });
});
