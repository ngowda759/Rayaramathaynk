import type { Page } from "@playwright/test";

/**
 * The five e2e accounts. global-setup.ts creates each one in the Auth emulator and writes its `users/{uid}` doc in the
 * Firestore emulator; `temple_admin_view_only` is a temple admin whose fake `me` answer carries `viewOnly: true`.
 */
export type E2ERole = "receptionist" | "prasadam_counter" | "temple_admin" | "temple_admin_view_only" | "super_admin";

export const E2E_ROLES: readonly E2ERole[] = [
  "receptionist",
  "prasadam_counter",
  "temple_admin",
  "temple_admin_view_only",
  "super_admin",
];

export const E2E_PASSWORD = "Password-123";

export function e2eEmail(role: E2ERole): string {
  return `e2e-${role}@example.test`;
}

/** The role behind an e2e address, or null for any other address. */
export function roleFromEmail(email: string | null | undefined): E2ERole | null {
  if (!email) return null;
  const match = /^e2e-([a-z_]+)@example\.test$/.exec(email.trim().toLowerCase());
  if (!match) return null;
  const role = match[1];
  return (E2E_ROLES as readonly string[]).includes(role) ? (role as E2ERole) : null;
}

/**
 * Signs in through the site's own email + password page (`/login`), then waits until the page has left it. The login
 * form sends the user to its `redirect` parameter about two seconds after a successful sign-in.
 */
export async function signInAs(page: Page, role: E2ERole, opts: { redirect?: string } = {}): Promise<void> {
  const redirect = opts.redirect ?? "/admin";
  await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`);
  const email = page.locator('input[name="email"]');
  await email.waitFor({ state: "visible", timeout: 60_000 });
  await email.fill(e2eEmail(role));
  await page.locator('input[name="password"]').fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });
}
