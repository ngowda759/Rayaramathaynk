import { render, waitFor } from "@testing-library/react";

import RegisterServiceWorker, {
  COUNTER_ONLY_SW_SCOPE,
  LEGACY_SW_SCOPE,
  SEVA_SW_SCOPE,
  SEVA_SW_URL,
} from "@/components/seva/counter/RegisterServiceWorker";
import { SEVA_ROUTES } from "@/lib/seva/routes";

type FakeRegistration = { scope: string; unregister: jest.Mock<Promise<boolean>, []> };

function registration(scopePath: string): FakeRegistration {
  return { scope: `http://localhost${scopePath}`, unregister: jest.fn(async () => true) };
}

const env = process.env as Record<string, string | undefined>;
const savedNodeEnv = env.NODE_ENV;
const savedServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");

function installServiceWorker(existing: FakeRegistration[]) {
  const register = jest.fn(async () => ({}));
  const getRegistrations = jest.fn(async () => existing);
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register, getRegistrations },
  });
  return { register, getRegistrations };
}

afterEach(() => {
  env.NODE_ENV = savedNodeEnv;
  if (savedServiceWorker) {
    Object.defineProperty(navigator, "serviceWorker", savedServiceWorker);
  } else {
    delete (navigator as unknown as Record<string, unknown>).serviceWorker;
  }
});

describe("RegisterServiceWorker", () => {
  it("registers /seva-sw.js for the /seva scope in production, so the installed app opens offline", async () => {
    env.NODE_ENV = "production";
    const { register } = installServiceWorker([]);
    render(<RegisterServiceWorker />);
    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(SEVA_SW_SCOPE).toBe(SEVA_ROUTES.dashboard);
    expect(register).toHaveBeenCalledWith(SEVA_SW_URL, { scope: "/seva" });
    expect(SEVA_SW_URL).toBe("/seva-sw.js");
  });

  it("unregisters an old worker left at /admin/receipts/counter and keeps every other worker", async () => {
    env.NODE_ENV = "production";
    expect(LEGACY_SW_SCOPE).toBe("/admin/receipts/counter");
    const legacy = registration("/admin/receipts/counter");
    const legacyBelow = registration("/admin/receipts/counter/today");
    const current = registration("/seva");
    const lookAlike = registration("/admin/receipts/counterfeit");
    const other = registration("/");
    const { register } = installServiceWorker([legacy, legacyBelow, current, lookAlike, other]);
    render(<RegisterServiceWorker />);
    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(legacy.unregister).toHaveBeenCalledTimes(1);
    expect(legacyBelow.unregister).toHaveBeenCalledTimes(1);
    expect(current.unregister).not.toHaveBeenCalled();
    expect(lookAlike.unregister).not.toHaveBeenCalled();
    expect(other.unregister).not.toHaveBeenCalled();
    const unregisterOrder = legacy.unregister.mock.invocationCallOrder[0];
    expect(unregisterOrder).toBeLessThan(register.mock.invocationCallOrder[0]);
  });

  it("unregisters the counter-only worker at /seva/counter, which the /seva worker replaces", async () => {
    env.NODE_ENV = "production";
    expect(COUNTER_ONLY_SW_SCOPE).toBe("/seva/counter");
    const counterOnly = registration("/seva/counter");
    const counterOnlySlash = registration("/seva/counter/");
    const current = registration("/seva");
    const { register } = installServiceWorker([counterOnly, counterOnlySlash, current]);
    render(<RegisterServiceWorker />);
    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(counterOnly.unregister).toHaveBeenCalledTimes(1);
    expect(counterOnlySlash.unregister).toHaveBeenCalledTimes(1);
    expect(current.unregister).not.toHaveBeenCalled();
  });

  it("does nothing in development", async () => {
    env.NODE_ENV = "development";
    const { register, getRegistrations } = installServiceWorker([registration("/admin/receipts/counter")]);
    render(<RegisterServiceWorker />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getRegistrations).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });
});
