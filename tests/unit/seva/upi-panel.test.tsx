import "@testing-library/jest-dom";
import { cleanup, render } from "@testing-library/react";

import { UpiPanel } from "@/components/seva/counter/UpiPanel";
import { fromPaise } from "@/lib/seva/money";

jest.mock("@/lib/seva/money", () => {
  const actual = jest.requireActual<typeof import("@/lib/seva/money")>("@/lib/seva/money");
  return { ...actual, fromPaise: jest.fn(actual.fromPaise) };
});

jest.mock("@/components/seva/slip/SlipQr", () => ({
  SlipQr: ({ url }: { url: string }) => <span data-testid="qr-url">{url}</span>,
}));

afterEach(cleanup);

describe("UpiPanel (L-13)", () => {
  it("puts the amount into the QR through fromPaise: 50505 paise gives 505.05", () => {
    const { getByTestId } = render(
      <UpiPanel
        upi={{ vpa: "temple@upi", payeeName: "Temple" }}
        totalPaise={50505}
        note="Seva"
        refLast6=""
        seenConfirmed={false}
        onRef={() => undefined}
        onSeen={() => undefined}
      />,
    );
    expect(fromPaise).toHaveBeenCalledWith(50505);
    const url = new URL(getByTestId("qr-url").textContent ?? "");
    expect(url.searchParams.get("am")).toBe("505.05");
  });
});
