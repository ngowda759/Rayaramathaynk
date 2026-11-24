/**
 * @jest-environment jsdom
 *
 * F-05 follow-up: the temple-areas admin page hides actions the signed-in role
 * cannot perform. `temple_areas.delete` is super-admin only, so a temple admin
 * must not see a delete control that the API would refuse with 403.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

import type { TempleArea } from "@/types/temple-explorer";

let mockCaps = new Set<string>();
jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ can: (capability: string) => mockCaps.has(capability) }),
}));

const mockApiFetch = jest.fn();
jest.mock("@/lib/api/fetch", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("@/components/admin/common/AdminPageHeader", () => ({
  __esModule: true,
  default: ({ title, action }: { title: string; action?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {action}
    </div>
  ),
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

jest.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
}));

jest.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
}));

import TempleAreasPage from "@/app/admin/temple-areas/page";

const AREA: TempleArea = {
  id: "area-1",
  name: "Main Sanctum",
  description: "The primary shrine",
  icon: "🛕",
  category: "sanctum",
};

async function renderExpanded() {
  render(<TempleAreasPage />);
  const category = await screen.findByText("Sacred Sanctuaries");
  fireEvent.click(category);
  expect(await screen.findByText("Main Sanctum")).toBeInTheDocument();
}

beforeEach(() => {
  mockCaps = new Set<string>();
  mockApiFetch.mockReset().mockResolvedValue({ success: true, areas: [AREA] });
});

describe("temple areas admin action gating", () => {
  it("shows create and edit but no delete for a temple admin", async () => {
    mockCaps = new Set(["temple_areas.write"]);
    await renderExpanded();

    expect(screen.getByRole("button", { name: /add area/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Edit area")).toBeInTheDocument();
    expect(screen.queryByLabelText("Delete area")).not.toBeInTheDocument();
  });

  it("shows delete only for a super admin", async () => {
    mockCaps = new Set(["temple_areas.write", "temple_areas.delete"]);
    await renderExpanded();

    expect(screen.getByRole("button", { name: /add area/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Edit area")).toBeInTheDocument();
    expect(screen.getByLabelText("Delete area")).toBeInTheDocument();
  });

  it("hides every write control for a read-only role", async () => {
    mockCaps = new Set<string>();
    await renderExpanded();

    expect(screen.queryByRole("button", { name: /add area/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Edit area")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Delete area")).not.toBeInTheDocument();
  });
});
