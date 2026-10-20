/**
 * LoginForm after a successful sign-in (A4S security gate, H-1): `?redirect=` is followed only when it is a path on
 * this site. A `javascript:` URL, a `//host` value or one that normalises to `//host` (`/.//host`) lands on `/`.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import LoginForm from "@/components/auth/LoginForm";
import { assignLocation } from "@/lib/auth/safe-return";

jest.mock("@/lib/auth/safe-return", () => ({
  ...jest.requireActual("@/lib/auth/safe-return"),
  assignLocation: jest.fn(),
}));

const mockSearch = { current: "" };
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(mockSearch.current),
}));

const mockLogin = jest.fn(async () => undefined);
jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, loading: false, login: mockLogin }),
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

const assign = assignLocation as jest.MockedFunction<typeof assignLocation>;

async function signInWith(search: string): Promise<void> {
  mockSearch.current = search;
  render(<LoginForm />);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(10);
  });
  fireEvent.change(screen.getByPlaceholderText("Enter your email"), { target: { value: "admin@example.com" } });
  fireEvent.change(screen.getByPlaceholderText("Enter your password"), { target: { value: "secret123" } });
  await act(async () => {
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);
    await jest.advanceTimersByTimeAsync(10);
  });
  expect(mockLogin).toHaveBeenCalledWith("admin@example.com", "secret123");
  expect(assign).not.toHaveBeenCalled(); // the redirect waits for the session to persist
  await act(async () => {
    await jest.advanceTimersByTimeAsync(2000);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  assign.mockReset();
  mockLogin.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("LoginForm redirect after sign-in", () => {
  it.each([
    ["a javascript: URL", "redirect=javascript:alert(1)"],
    ["a //host value", "redirect=//evil.example"],
    ["an encoded //host value", "redirect=%2F%2Fevil.example"],
    ["an absolute URL to another site", "redirect=https://evil.example"],
    ["a dot segment that normalises to //host", "redirect=/.//evil.example"],
    ["no redirect", ""],
  ])("lands on / for %s", async (_label, search) => {
    await signInWith(search);
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/");
  });

  it("follows a same-origin path with its query", async () => {
    await signInWith("redirect=%2Fseva%2Fregister%3Fstatus%3Dchanged");
    expect(assign).toHaveBeenCalledWith("/seva/register?status=changed");
  });
});
