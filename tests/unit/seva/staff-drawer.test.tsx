import "@testing-library/jest-dom";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { OnboardDialog, onboardRoleAllowed } from "@/components/seva/staff/OnboardDialog";
import { StaffDrawer, staffRights, type StaffCan } from "@/components/seva/staff/StaffDrawer";
import { StaffList } from "@/components/seva/staff/StaffList";
import { sevaErrorMessage } from "@/lib/seva/errors";
import { can as matrixCan } from "@/lib/seva/permissions";
import { SevaClientError } from "@/services/seva/http";
import type { StaffApi } from "@/services/seva/staff.service";
import type { SevaMe, SevaRole } from "@/types/seva";
import type { StaffMember } from "@/types/seva-staff";

/**
 * Staff and roles (plan A4-11; DB §3.3 rows 18-23, §3.4, §13.6). The page only hides; these tests pin that what it
 * offers mirrors lib/seva/server/staff.ts exactly, so nobody is offered a button the server would refuse.
 */

/* ---------- helpers ---------- */

function meOf(role: SevaRole, viewOnly = false): SevaMe {
  return { staffId: `me-${role}`, staffNo: 8, name: "Prakash Rao", role, viewOnly, actions: [], counter: null };
}

function canOf(me: SevaMe): StaffCan {
  return (action, ctx) => matrixCan(me, action, ctx);
}

const TA = meOf("temple_admin");
const SA = meOf("super_admin");

function member(over: Partial<StaffMember> = {}): StaffMember {
  return {
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
    ...over,
  };
}

function fakeApi(over: Partial<Record<keyof StaffApi, jest.Mock>> = {}): StaffApi & Record<keyof StaffApi, jest.Mock> {
  return {
    list: jest.fn().mockResolvedValue([]),
    nextStaffNo: jest.fn().mockResolvedValue(35),
    onboard: jest.fn().mockResolvedValue({ staffId: "new-id", staffNo: 35 }),
    update: jest.fn().mockResolvedValue(undefined),
    ...over,
  };
}

function renderDrawer(me: SevaMe, target: StaffMember, api = fakeApi()) {
  const onChanged = jest.fn();
  const onClose = jest.fn();
  render(<StaffDrawer member={target} meStaffId={me.staffId} can={canOf(me)} api={api} onClose={onClose} onChanged={onChanged} />);
  return { api, onChanged, onClose };
}

function renderOnboard(me: SevaMe, api = fakeApi(), sendInvite = jest.fn().mockResolvedValue(undefined)) {
  const onOnboarded = jest.fn();
  render(
    <OnboardDialog open onClose={jest.fn()} api={api} sendInvite={sendInvite} can={canOf(me)} onOnboarded={onOnboarded} />,
  );
  return { api, sendInvite, onOnboarded };
}

function roleRadio(name: RegExp): HTMLElement {
  return screen.getByRole("radio", { name });
}

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

/* ---------- the plan's tests ---------- */

describe("Staff and roles", () => {
  it("offers Super admin only to super admins and view-only only for temple admins", async () => {
    // Onboard dialog, temple admin: three roles, never Super admin (DB §3.3 rows 18-19).
    renderOnboard(TA);
    await screen.findByDisplayValue("35");
    expect(roleRadio(/^Receptionist/)).toBeEnabled();
    expect(roleRadio(/^Prasadam counter/)).toBeEnabled();
    expect(roleRadio(/^Temple admin/)).toBeEnabled();
    expect(roleRadio(/^Super admin/)).toBeDisabled();
    expect(screen.getByText("Only a super admin can give the Super admin role.")).toBeInTheDocument();
    // View-only only once Temple admin is chosen.
    const viewOnly = screen.getByRole("switch", { name: /View-only/ });
    expect(viewOnly).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(roleRadio(/^Temple admin/));
    expect(screen.getByRole("switch", { name: /View-only/ })).not.toHaveAttribute("aria-disabled", "true");
    cleanup();

    // Onboard dialog, super admin: all four.
    renderOnboard(SA);
    await screen.findByDisplayValue("35");
    expect(roleRadio(/^Super admin/)).toBeEnabled();
    cleanup();

    // Drawer, temple admin on a receptionist: Super admin not offered; view-only only for a temple admin.
    renderDrawer(TA, member());
    expect(roleRadio(/^Super admin/)).toBeDisabled();
    expect(roleRadio(/^Temple admin/)).toBeEnabled();
    expect(screen.getByRole("switch", { name: /View-only/ })).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(roleRadio(/^Temple admin/));
    expect(screen.getByRole("switch", { name: /View-only/ })).not.toHaveAttribute("aria-disabled", "true");
    cleanup();

    // Drawer, super admin: Super admin can be given.
    renderDrawer(SA, member());
    expect(roleRadio(/^Super admin/)).toBeEnabled();

    // The pure rule matches the matrix for every role.
    for (const role of ["receptionist", "prasadam_counter", "temple_admin"] as const) {
      expect(onboardRoleAllowed(canOf(TA), role)).toBe(true);
      expect(onboardRoleAllowed(canOf(SA), role)).toBe(true);
    }
    expect(onboardRoleAllowed(canOf(TA), "super_admin")).toBe(false);
    expect(onboardRoleAllowed(canOf(SA), "super_admin")).toBe(true);
    expect(onboardRoleAllowed(canOf(meOf("temple_admin", true)), "receptionist")).toBe(false);
  });

  it("needs a reason to offboard or delete and warns before delete", async () => {
    const target = member({ fullName: "Mrs. Kamala Iyengar", staffNo: 12, role: "temple_admin", viewOnly: true });
    const { api, onChanged } = renderDrawer(SA, target);

    fireEvent.click(screen.getByRole("button", { name: "Offboard (deactivate)" }));
    const offReason = screen.getByLabelText(/Why is Mrs. Kamala Iyengar being offboarded\?/);
    const offOk = screen.getByRole("button", { name: "Deactivate Mrs. Kamala Iyengar" });
    expect(offOk).toBeDisabled();
    fireEvent.change(offReason, { target: { value: "ok" } });
    expect(offOk).toBeDisabled();
    fireEvent.change(offReason, { target: { value: "Stepped down from the committee" } });
    expect(offOk).toBeEnabled();
    fireEvent.click(offOk);
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(target.id, { status: "inactive", reason: "Stepped down from the committee" }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    cleanup();

    const second = renderDrawer(SA, target);
    fireEvent.click(screen.getByRole("button", { name: "Delete user" }));
    const warning = screen.getByRole("note");
    expect(warning).toHaveTextContent("Deactivating is usually right.");
    expect(warning).toHaveTextContent("Past receipts keep the name and staff no.");
    const delReason = screen.getByLabelText(/Why delete rather than deactivate\?/);
    const confirm = within(screen.getByRole("group", { name: "Delete user" })).getByRole("button", { name: "Delete user" });
    expect(confirm).toBeDisabled();
    fireEvent.change(delReason, { target: { value: "Account created by mistake" } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(second.api.update).toHaveBeenCalledWith(target.id, { status: "deleted", reason: "Account created by mistake" }),
    );
  });

  it("a temple admin does not see Offboard or Delete", () => {
    renderDrawer(TA, member());
    expect(screen.queryByRole("button", { name: "Offboard (deactivate)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete user" })).not.toBeInTheDocument();
    expect(screen.getByText("Offboarding and deleting a user are done by a super admin.")).toBeInTheDocument();
  });

  it("onboarding pre-fills the next staff number and sends the set-password email", async () => {
    const { api, sendInvite, onOnboarded } = renderOnboard(TA);
    expect(await screen.findByDisplayValue("35")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "  Meera Bhat " } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "Meera.Bhat@Example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
    await waitFor(() =>
      expect(api.onboard).toHaveBeenCalledWith({
        fullName: "Meera Bhat",
        email: "meera.bhat@example.com",
        role: "receptionist",
        viewOnly: false,
        staffNo: 35,
      }),
    );
    await waitFor(() => expect(sendInvite).toHaveBeenCalledWith("meera.bhat@example.com"));
    expect(onOnboarded).toHaveBeenCalledWith({ staffNo: 35, fullName: "Meera Bhat" });
    // The email goes only after the server has onboarded the person.
    expect(api.onboard.mock.invocationCallOrder[0]).toBeLessThan(sendInvite.mock.invocationCallOrder[0]);
  });

  function existingAccount(
    currentRole: string | null,
    displayName: string | null,
    currentlyActive: boolean | null = true,
  ): SevaClientError {
    return new SevaClientError("validation", 400, "This email already has a sign-in account.", {
      field: "email",
      reason: "existing_account",
      currentRole,
      currentlyActive,
      displayName,
      message: "This email already has a sign-in account.",
    });
  }

  it("the link question says when the account is inactive on the website", async () => {
    const api = fakeApi({ onboard: jest.fn().mockRejectedValueOnce(existingAccount("admin", "Lapsed Admin", false)) });
    renderOnboard(TA, api);
    await screen.findByDisplayValue("35");
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Lapsed Admin" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "lapsed@example.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
    const confirm = await screen.findByRole("region", { name: "Existing website account" });
    expect(confirm).toHaveTextContent("This account is currently inactive; linking makes it active.");
  });

  it("an unverified or disabled account gets the server's reason and no Link this account", async () => {
    const unverified = new SevaClientError("validation", 400, "Some details are missing or not right.", {
      field: "email",
      reason: "unverified_account",
      message: "server text",
    });
    const disabled = new SevaClientError("validation", 400, "Some details are missing or not right.", {
      field: "email",
      reason: "disabled_account",
      message: "server text",
    });
    const api = fakeApi({ onboard: jest.fn().mockRejectedValueOnce(unverified).mockRejectedValueOnce(disabled) });
    renderOnboard(SA, api);
    await screen.findByDisplayValue("35");
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Nikhil N" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "impostor@example.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("not verified");
    expect(alert).toHaveTextContent("register again or contact the site owner");
    expect(screen.queryByRole("button", { name: "Link this account" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("switched off"));
    expect(screen.queryByRole("button", { name: "Link this account" })).not.toBeInTheDocument();
  });

  it("an email with a website account asks first, then links it with no set-password email", async () => {
    const api = fakeApi({
      onboard: jest
        .fn()
        .mockRejectedValueOnce(existingAccount("admin", "Nikhil N"))
        .mockResolvedValueOnce({ staffId: "new-id", staffNo: 35, linkedExisting: true }),
    });
    const { sendInvite, onOnboarded } = renderOnboard(SA, api);
    await screen.findByDisplayValue("35");
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Nikhil N" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "nikhil@example.org" } });
    fireEvent.click(roleRadio(/^Super admin/));
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

    const confirm = await screen.findByRole("region", { name: "Existing website account" });
    expect(confirm).toHaveTextContent(
      "Nikhil N already has a website account (current role: Temple admin). Add them as staff and set their role to Super admin? They keep their password.",
    );
    expect(sendInvite).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Send invite" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeDisabled();

    fireEvent.click(within(confirm).getByRole("button", { name: "Link this account" }));
    await waitFor(() => expect(onOnboarded).toHaveBeenCalledWith({ staffNo: 35, fullName: "Nikhil N", linkedExisting: true }));
    expect(api.onboard).toHaveBeenCalledTimes(2);
    expect(api.onboard.mock.calls[1][0]).toEqual({
      fullName: "Nikhil N",
      email: "nikhil@example.org",
      role: "super_admin",
      viewOnly: false,
      staffNo: 35,
      linkExisting: true,
    });
    // They keep their own password: no set-password email for a linked account.
    expect(sendInvite).not.toHaveBeenCalled();
  });

  it("Cancel on the link question goes back to the form, and the list says a linked account keeps its password", async () => {
    const api = fakeApi({ onboard: jest.fn().mockRejectedValueOnce(existingAccount("devotee", null)) });
    renderOnboard(TA, api);
    await screen.findByDisplayValue("35");
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Priya S" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "priya@example.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
    const confirm = await screen.findByRole("region", { name: "Existing website account" });
    // No name on the account: the email stands in; a role with no seva meaning is shown as stored.
    expect(confirm).toHaveTextContent("priya@example.org already has a website account (current role: devotee).");
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("region", { name: "Existing website account" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Send invite" })).toBeInTheDocument();
    expect(api.onboard).toHaveBeenCalledTimes(1);
    cleanup();

    const listApi = fakeApi({
      onboard: jest
        .fn()
        .mockRejectedValueOnce(existingAccount("devotee", "Priya S"))
        .mockResolvedValueOnce({ staffId: "new-id", staffNo: 35, linkedExisting: true }),
    });
    render(<StaffList api={listApi} sendInvite={jest.fn()} me={TA} can={canOf(TA)} startOnboarding />);
    await screen.findByDisplayValue("35");
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Priya S" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "priya@example.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
    fireEvent.click(await screen.findByRole("button", { name: "Link this account" }));
    expect(await screen.findByText("Account linked · staff no. 035")).toBeInTheDocument();
    expect(screen.getByText("They can sign in with their existing password.")).toBeInTheDocument();
  });

  it("a partial failure names the step that failed", async () => {
    const failure = new SevaClientError("partial_failure", 502, sevaErrorMessage("partial_failure"), {
      done: ["identity"],
      failed: "staff",
      cause: "internal",
    });
    renderDrawer(SA, member(), fakeApi({ update: jest.fn().mockRejectedValue(failure) }));
    fireEvent.click(roleRadio(/^Temple admin/));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const alert = await screen.findByRole("alert");
    // The shared partial_failure message heads the notice, with each step's line under it.
    expect(alert).toHaveTextContent("Only part of this change was saved. Check the details and try again.");
    expect(alert).toHaveTextContent("Done: Sign-in account (login and role)");
    expect(alert).toHaveTextContent("Failed at: Staff record");
    cleanup();

    // Onboarded, but the set-password email failed: the email is the step named.
    const sendInvite = jest.fn().mockRejectedValue(new Error("auth/network-request-failed"));
    renderOnboard(TA, fakeApi(), sendInvite);
    await screen.findByDisplayValue("35");
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Meera Bhat" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "meera@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
    const emailAlert = await screen.findByRole("alert");
    expect(emailAlert).toHaveTextContent("Staff no. 035 is onboarded, but the set-password email was not sent.");
    expect(emailAlert).toHaveTextContent("Failed at: Set-password email");
    sendInvite.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Send the email again" }));
    await waitFor(() => expect(sendInvite).toHaveBeenCalledTimes(2));
  });

  it("a row's partial failure is headed by the shared partial_failure message, as in the drawer", async () => {
    const failure = new SevaClientError("partial_failure", 502, sevaErrorMessage("partial_failure"), {
      done: ["identity"],
      failed: "staff",
      cause: "internal",
    });
    const api = fakeApi({
      list: jest.fn().mockResolvedValue([member({ fullName: "Girish M", staffNo: 19, status: "inactive" })]),
      update: jest.fn().mockRejectedValue(failure),
    });
    render(<StaffList api={api} sendInvite={jest.fn()} me={SA} can={canOf(SA)} />);
    fireEvent.click(await screen.findByRole("button", { name: "Reactivate Girish M" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(`Girish M: ${sevaErrorMessage("partial_failure")}`);
    expect(alert).not.toHaveTextContent("The change went only part of the way");
    expect(alert).toHaveTextContent("Failed at: Staff record");
  });

  /* ---------- A3-FIX (security review): reactivating a super admin needs staff.grant_super_admin ---------- */

  it("offers Reactivate on a super-admin target only to super admins", async () => {
    const inactiveSuper = member({ id: "22222222-2222-4222-8222-222222222222", fullName: "Old Trustee", role: "super_admin", status: "inactive" });
    const inactiveReceptionist = member({ fullName: "Girish M", staffNo: 19, status: "inactive" });

    // Pure rule, exactly as updateStaff: staff.reactivate, plus staff.grant_super_admin when the target is a super admin.
    expect(staffRights(canOf(TA), TA.staffId, inactiveSuper).reactivate).toBe(false);
    expect(staffRights(canOf(SA), SA.staffId, inactiveSuper).reactivate).toBe(true);
    expect(staffRights(canOf(TA), TA.staffId, inactiveReceptionist).reactivate).toBe(true);
    expect(staffRights(canOf(meOf("temple_admin", true)), "x", inactiveReceptionist).reactivate).toBe(false);
    expect(staffRights(canOf(SA), SA.staffId, member({ status: "active" })).reactivate).toBe(false);
    expect(staffRights(canOf(SA), SA.staffId, member({ status: "deleted" })).reactivate).toBe(false);

    // Drawer: a temple admin is told why; a super admin gets the button and it sends status active.
    renderDrawer(TA, inactiveSuper);
    expect(screen.queryByRole("button", { name: /^Reactivate/ })).not.toBeInTheDocument();
    expect(screen.getByText("Only a super admin can reactivate a super admin.")).toBeInTheDocument();
    cleanup();

    const asSuper = renderDrawer(SA, inactiveSuper);
    fireEvent.click(screen.getByRole("button", { name: /^Reactivate/ }));
    await waitFor(() => expect(asSuper.api.update).toHaveBeenCalledWith(inactiveSuper.id, { status: "active" }));
    cleanup();

    // List rows follow the same rule.
    const api = fakeApi({ list: jest.fn().mockResolvedValue([inactiveSuper, inactiveReceptionist]) });
    render(<StaffList api={api} sendInvite={jest.fn()} me={TA} can={canOf(TA)} />);
    await screen.findByText("Old Trustee");
    expect(screen.queryByRole("button", { name: "Reactivate Old Trustee" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reactivate Girish M" })).toBeInTheDocument();
    cleanup();

    render(<StaffList api={api} sendInvite={jest.fn()} me={SA} can={canOf(SA)} />);
    await screen.findByText("Old Trustee");
    expect(screen.getByRole("button", { name: "Reactivate Old Trustee" })).toBeInTheDocument();
  });

  /* ---------- mirror of the other server rules ---------- */

  it("mirrors the server: nobody changes themself, a temple admin never touches a super admin, deleted stays deleted", () => {
    const self = member({ id: TA.staffId });
    const none = staffRights(canOf(TA), TA.staffId, self);
    expect(none.self).toBe(true);
    expect(Object.values(none.roles).some(Boolean)).toBe(false);
    expect(none.viewOnly).toBe(false);

    const superTarget = staffRights(canOf(TA), TA.staffId, member({ role: "super_admin" }));
    expect(Object.values(superTarget.roles).some(Boolean)).toBe(false);
    expect(superTarget.offboard || superTarget.remove || superTarget.reactivate).toBe(false);

    const deleted = staffRights(canOf(SA), SA.staffId, member({ status: "deleted" }));
    expect(Object.values(deleted.roles).some(Boolean) || deleted.offboard || deleted.remove).toBe(false);

    const legacy = staffRights(canOf(TA), TA.staffId, member({ role: null }));
    expect(Object.values(legacy.roles).some(Boolean)).toBe(false);

    const bySuper = staffRights(canOf(SA), SA.staffId, member({ status: "inactive" }));
    expect(bySuper.offboard).toBe(false);
    expect(bySuper.remove).toBe(true);
  });

  it("lists staff with the view-only badge, statuses, the filter and the inactive line", async () => {
    const api = fakeApi({
      list: jest.fn().mockResolvedValue([
        member({ id: TA.staffId, fullName: "Prakash Rao", staffNo: 8, role: "temple_admin" }),
        member({ id: "33333333-3333-4333-8333-333333333333", fullName: "Mrs. Kamala Iyengar", staffNo: 12, role: "temple_admin", viewOnly: true }),
        member({ id: "44444444-4444-4444-8444-444444444444", fullName: "Lakshmi Narayan", staffNo: 34, status: "invited", lastActiveAt: null, firstSignedInAt: null }),
        member({ id: "55555555-5555-4555-8555-555555555555", fullName: "Girish M", staffNo: 19, status: "inactive" }),
      ]),
    });
    render(<StaffList api={api} sendInvite={jest.fn()} me={TA} can={canOf(TA)} />);
    await screen.findByText("Mrs. Kamala Iyengar");
    expect(api.list).toHaveBeenCalledWith("all");
    expect(screen.getByText("Inactive staff cannot sign in and stay for the audit trail.")).toBeInTheDocument();
    const kamala = screen.getByText("Mrs. Kamala Iyengar").closest("tr") as HTMLElement;
    expect(within(kamala).getByText(/View-only/)).toBeInTheDocument();
    expect(within(kamala).getByText("012")).toBeInTheDocument();
    const lakshmi = screen.getByText("Lakshmi Narayan").closest("tr") as HTMLElement;
    expect(within(lakshmi).getByText("Invited")).toBeInTheDocument();
    expect(within(lakshmi).getByText(/not signed in yet/)).toBeInTheDocument();
    const self = screen.getByText("Prakash Rao").closest("tr") as HTMLElement;
    expect(within(self).getByText("You")).toBeInTheDocument();
    expect(within(self).queryByRole("button")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /^Inactive/ }));
    expect(screen.queryByText("Mrs. Kamala Iyengar")).not.toBeInTheDocument();
    expect(screen.getByText("Girish M")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /^Active/ }));
    expect(screen.getByText("Lakshmi Narayan")).toBeInTheDocument();
    expect(screen.queryByText("Girish M")).not.toBeInTheDocument();
  });
});
