import "@testing-library/jest-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { StaffCan } from "@/components/seva/staff/StaffDrawer";
import { StaffList } from "@/components/seva/staff/StaffList";
import { can as matrixCan } from "@/lib/seva/permissions";
import type { StaffApi } from "@/services/seva/staff.service";
import type { SevaMe } from "@/types/seva";
import type { StaffMember } from "@/types/seva-staff";

/**
 * Plan A4P-4 review: /admin/users is outside the seva layouts, so StaffList brings its own SevaMotion. With the
 * system asking for less motion, the rows and the drawer must arrive without any transform motion (they fade only),
 * and they must arrive at all (the LazyMotion features load inside the list, not by luck from another import).
 *
 * Its own file: framer reads prefers-reduced-motion once, at the first motion mount in a test file.
 */

const ME: SevaMe = { staffId: "me-temple_admin", staffNo: 8, name: "Prakash Rao", role: "temple_admin", viewOnly: false, actions: [], counter: null };
const CAN: StaffCan = (action, ctx) => matrixCan(ME, action, ctx);

const RAMESH: StaffMember = {
  id: "11111111-1111-4111-8111-111111111111",
  staffNo: 23,
  fullName: "Ramesh K",
  email: "ramesh.k@example.com",
  role: "receptionist",
  viewOnly: false,
  status: "active",
  lastActiveAt: "2026-10-18T05:35:00.000Z",
  invitedAt: "2026-10-01T05:00:00.000Z",
  firstSignedInAt: "2026-10-02T05:00:00.000Z",
};

function fakeApi(): StaffApi {
  return {
    list: jest.fn().mockResolvedValue([RAMESH]),
    nextStaffNo: jest.fn().mockResolvedValue(35),
    onboard: jest.fn().mockResolvedValue({ staffId: "new-id", staffNo: 35 }),
    update: jest.fn().mockResolvedValue(undefined),
  };
}

/** Every inline transform the element shows from now on. */
function watchTransforms(el: HTMLElement): { seen: string[]; stop(): void } {
  const seen = [el.style.transform];
  const observer = new MutationObserver(() => seen.push(el.style.transform));
  observer.observe(el, { attributes: true, attributeFilter: ["style"] });
  return { seen, stop: () => observer.disconnect() };
}

/** A transform part-way through a move: neither the starting pose nor the resting one. */
function inBetween(transform: string, start: string): boolean {
  return transform !== "" && transform !== "none" && transform !== start;
}

const originalMatchMedia = window.matchMedia;

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    // framer asks for "(prefers-reduced-motion)"; the system asks for less motion.
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as typeof window.matchMedia;
});

afterAll(() => {
  window.matchMedia = originalMatchMedia;
});

afterEach(() => {
  cleanup();
});

describe("Staff screen motion", () => {
  it("under reduced motion the rows and the drawer show without transform motion", async () => {
    render(<StaffList api={fakeApi()} sendInvite={jest.fn()} me={ME} can={CAN} />);

    const row = (await screen.findByText("Ramesh K")).closest("tr") as HTMLElement;
    const rowStart = row.style.transform;
    const rowMoves = watchTransforms(row);
    // The row arrives: fully opaque and at rest (without SevaMotion's features it would stay at opacity 0).
    await waitFor(() => expect(row.style.opacity).toBe("1"), { timeout: 3000 });
    rowMoves.stop();
    expect(row.style.transform === "" || row.style.transform === "none").toBe(true);
    expect(rowMoves.seen.filter((t) => inBetween(t, rowStart))).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Open Ramesh K" }));
    const drawer = await screen.findByRole("dialog");
    const drawerStart = drawer.style.transform;
    const drawerMoves = watchTransforms(drawer);
    await waitFor(() => expect(drawer.style.opacity).toBe("1"), { timeout: 3000 });
    drawerMoves.stop();
    expect(drawer.style.transform === "" || drawer.style.transform === "none").toBe(true);
    expect(drawerMoves.seen.filter((t) => inBetween(t, drawerStart))).toEqual([]);
  });
});
