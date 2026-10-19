import { expect, test, type Page } from "@playwright/test";
import type { StaffMember } from "../../../types/seva-staff";
import { signInAs } from "./fixtures/auth";
import { E2E_STAFF } from "./fixtures/data";
import { FakeApiError, createFakeSevaApi, fakeResponse, type FakeSevaApi } from "./fixtures/fake-api";

/**
 * Staff and roles (plan A4-11, DB §13.6). Every /api/seva/** call is answered by the fake API; this file answers the
 * staff routes in the real wire shape (StaffListResponse, StaffOnboardResponse, 502 partial_failure) on top of it.
 * Firebase's set-password request (accounts:sendOobCode, C-56) is caught before it reaches the Auth emulator.
 */

const PAGE = "/admin/users";

function person(over: Partial<StaffMember> & Pick<StaffMember, "id" | "staffNo" | "fullName">): StaffMember {
  return {
    email: `${over.fullName.toLowerCase().replace(/[^a-z]+/g, ".")}@example.test`,
    role: "receptionist",
    viewOnly: false,
    status: "active",
    lastActiveAt: "2026-10-18T05:35:00.000Z",
    invitedAt: "2026-10-01T05:00:00.000Z",
    firstSignedInAt: "2026-10-02T05:00:00.000Z",
    ...over,
  };
}

function seedStaff(): StaffMember[] {
  return [
    person({ id: E2E_STAFF.super_admin.staffId, staffNo: 1, fullName: E2E_STAFF.super_admin.name, role: "super_admin" }),
    person({ id: E2E_STAFF.temple_admin.staffId, staffNo: 5, fullName: E2E_STAFF.temple_admin.name, role: "temple_admin" }),
    person({ id: "staff-kamala", staffNo: 12, fullName: "Kamala Iyengar", role: "temple_admin", viewOnly: true }),
    person({ id: "staff-ramesh", staffNo: 23, fullName: "Ramesh K" }),
    person({ id: "staff-girish", staffNo: 19, fullName: "Girish M", status: "inactive" }),
  ];
}

interface StaffFake {
  fake: FakeSevaApi;
  staff: StaffMember[];
  invites: string[];
}

/** The fake API with the staff routes answered in their real shape, and the set-password email caught. */
async function openStaffPage(page: Page, role: "temple_admin" | "super_admin", opts: { failPut?: boolean } = {}): Promise<StaffFake> {
  const fake = createFakeSevaApi();
  const staff = seedStaff();
  const invites: string[] = [];
  fake.extend({
    "GET staff": (req) => {
      if (req.path.includes("view=next-staff-no")) {
        return { nextStaffNo: staff.reduce((max, s) => Math.max(max, s.staffNo), 0) + 1 };
      }
      return { staff };
    },
    "POST staff": (req) => {
      const body = req.body as { fullName: string; email: string; role: StaffMember["role"]; viewOnly: boolean; staffNo: number };
      if (body.role === "super_admin" && role !== "super_admin") throw new FakeApiError(403, "forbidden");
      const created = person({
        id: `staff-new-${body.staffNo}`,
        staffNo: body.staffNo,
        fullName: body.fullName,
        email: body.email,
        role: body.role,
        viewOnly: body.viewOnly,
        status: "invited",
        lastActiveAt: null,
        firstSignedInAt: null,
        invitedAt: new Date().toISOString(),
      });
      staff.push(created);
      return fakeResponse(201, { staffId: created.id, staffNo: created.staffNo });
    },
    "PUT staff/:id": () => {
      if (opts.failPut) {
        throw new FakeApiError(502, "partial_failure", { done: ["identity"], failed: "staff", cause: "internal" });
      }
      return { ok: true };
    },
  });
  await fake.install(page);
  await page.route("**/accounts:sendOobCode**", async (route) => {
    const body = route.request().postDataJSON() as { requestType?: string; email?: string } | null;
    if (body?.requestType === "PASSWORD_RESET" && body.email) invites.push(body.email);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ kind: "identitytoolkit#GetOobConfirmationCodeResponse", email: body?.email ?? "" }),
    });
  });
  await signInAs(page, role, { redirect: PAGE });
  await page.waitForURL((url) => url.pathname === PAGE, { timeout: 60_000 });
  await expect(page.getByText("Inactive staff cannot sign in and stay for the audit trail.")).toBeVisible({ timeout: 60_000 });
  return { fake, staff, invites };
}

test("onboarding pre-fills the next staff number and sends the set-password email", async ({ page }) => {
  const { fake, invites } = await openStaffPage(page, "temple_admin");

  await page.getByRole("button", { name: /Onboard staff/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Staff no.")).toHaveValue("24");
  await expect(dialog.getByRole("radio", { name: /^Super admin/ })).toBeDisabled();

  await dialog.getByLabel("Full name").fill("Meera Bhat");
  await dialog.getByLabel("Email").fill("meera.bhat@example.test");
  await dialog.getByRole("button", { name: "Send invite" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Invite sent · staff no. 024" })).toBeVisible();
  expect(invites).toEqual(["meera.bhat@example.test"]);
  const posted = fake.requests.find((r) => r.method === "POST" && r.path === "/api/seva/staff");
  expect(posted?.body).toEqual({
    fullName: "Meera Bhat",
    email: "meera.bhat@example.test",
    role: "receptionist",
    viewOnly: false,
    staffNo: 24,
  });
  await expect(page.getByRole("row").filter({ hasText: "Meera Bhat" })).toContainText("Invited");
});

test("a temple admin does not see Offboard or Delete", async ({ page }) => {
  await openStaffPage(page, "temple_admin");

  // A super admin's row has nothing for a temple admin to open; their own row says "You".
  await expect(page.getByRole("row").filter({ hasText: E2E_STAFF.super_admin.name })).toContainText("Super admin only");
  await expect(page.getByRole("row").filter({ hasText: E2E_STAFF.temple_admin.name })).toContainText("You");

  await page.getByRole("button", { name: "Open Ramesh K" }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByText("Offboarding and deleting a user are done by a super admin.")).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Offboard (deactivate)" })).toHaveCount(0);
  await expect(drawer.getByRole("button", { name: "Delete user" })).toHaveCount(0);
  await expect(drawer.getByRole("radio", { name: /^Super admin/ })).toBeDisabled();
});

test("a partial failure names the step that failed", async ({ page }) => {
  await openStaffPage(page, "super_admin", { failPut: true });

  await page.getByRole("button", { name: "Open Ramesh K" }).click();
  const drawer = page.getByRole("dialog");
  await drawer.locator("label").filter({ hasText: "Prasadam counter" }).click();
  await expect(drawer.getByRole("radio", { name: /^Prasadam counter/ })).toBeChecked();
  await drawer.getByRole("button", { name: "Save" }).click();

  const alert = drawer.getByRole("alert");
  // The shared partial_failure message (lib/seva/errors.ts), then each step's line under it.
  await expect(alert).toContainText("Only part of this change was saved. Check the details and try again.");
  await expect(alert).toContainText("Done: Sign-in account (login and role)");
  await expect(alert).toContainText("Failed at: Staff record");
});
