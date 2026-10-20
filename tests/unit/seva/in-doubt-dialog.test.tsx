import "@testing-library/jest-dom";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { InDoubtDialog } from "@/components/seva/counter/InDoubtDialog";
import { COUNTER_TEXT } from "@/lib/seva/strings/counter";

afterEach(cleanup);

/**
 * The in-doubt popup (owner's check 2026-10-20): it read like a printer error. It now says the temple's server did
 * not answer in time, that the receipt may or may not have been saved, and what each button does.
 */
describe("InDoubtDialog words", () => {
  it("says the server did not answer in time and that the receipt may or may not be saved, not a printer problem", () => {
    const { inDoubtTitle, inDoubtBody } = COUNTER_TEXT;
    expect(inDoubtTitle.en).toMatch(/server did not answer in time/i);
    expect(`${inDoubtTitle.en} ${inDoubtBody.en}`).not.toMatch(/printer/i);
    expect(inDoubtBody.en).toMatch(/may or may not have been saved/i);
    // Each button is named and explained, with the words on the buttons.
    expect(inDoubtBody.en).toContain(COUNTER_TEXT.inDoubtYes.en);
    expect(inDoubtBody.en).toContain(COUNTER_TEXT.inDoubtNo.en);
    expect(inDoubtBody.en).toMatch(/counted once/i);
    expect(inDoubtBody.en).toMatch(/prints nothing/i);
    // Kannada stays under the English.
    expect(inDoubtTitle.kn).toMatch(/[ಀ-೿]/);
    expect(inDoubtBody.kn).toMatch(/[ಀ-೿]/);
  });

  it("shows the title and the body with both buttons, Yes prints offline and No keeps the order", () => {
    const onAnswer = jest.fn();
    render(<InDoubtDialog open onAnswer={onAnswer} />);
    expect(screen.getByRole("dialog")).toHaveTextContent(COUNTER_TEXT.inDoubtTitle.en);
    expect(screen.getByRole("dialog")).toHaveTextContent(COUNTER_TEXT.inDoubtBody.en);
    fireEvent.click(screen.getByRole("button", { name: COUNTER_TEXT.inDoubtYes.en }));
    expect(onAnswer).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: COUNTER_TEXT.inDoubtNo.en }));
    expect(onAnswer).toHaveBeenLastCalledWith(false);
  });
});
