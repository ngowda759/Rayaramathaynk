import "@testing-library/jest-dom";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import ReportsLayout from "@/app/admin/receipts/reports/layout";

/**
 * Reports tabs (plan A4P-3): the open tab is marked by one indicator that slides to a tab the moment it is clicked,
 * before the new report has loaded; `aria-current` stays on the page actually open.
 */

const mockPath = { current: "/admin/receipts/reports" };

jest.mock("next/navigation", () => ({ usePathname: () => mockPath.current }));
// A plain anchor: the test checks the tab feedback, not Next's navigation.
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a
      href={href}
      {...props}
      onClick={(e) => {
        onClick?.(e);
        e.preventDefault();
      }}
    >
      {children}
    </a>
  ),
}));

function indicatorTab(): HTMLElement | null {
  const indicator = document.querySelector("[data-tab-indicator]");
  return indicator ? indicator.closest("a") : null;
}

afterEach(() => {
  cleanup();
  mockPath.current = "/admin/receipts/reports";
});

describe("reports tabs", () => {
  it("moves the sliding indicator to a clicked tab at once", () => {
    const { rerender } = render(
      <ReportsLayout>
        <p>report</p>
      </ReportsLayout>,
    );
    const summary = screen.getByRole("link", { name: /Seva summary/ });
    const audit = screen.getByRole("link", { name: /Audit trail/ });
    expect(document.querySelectorAll("[data-tab-indicator]")).toHaveLength(1);
    expect(indicatorTab()).toBe(summary);
    expect(summary).toHaveAttribute("aria-current", "page");

    fireEvent.click(audit);
    expect(indicatorTab()).toBe(audit);
    // Still on the summary until the audit page arrives.
    expect(summary).toHaveAttribute("aria-current", "page");
    expect(audit).not.toHaveAttribute("aria-current");

    mockPath.current = "/admin/receipts/reports/audit";
    rerender(
      <ReportsLayout>
        <p>audit</p>
      </ReportsLayout>,
    );
    expect(indicatorTab()).toBe(audit);
    expect(audit).toHaveAttribute("aria-current", "page");
  });
});
