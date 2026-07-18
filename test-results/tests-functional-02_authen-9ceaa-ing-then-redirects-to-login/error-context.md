# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/functional/02_authentication.spec.ts >> Authentication Module >> TC-053: Accessing admin page without auth shows loading then redirects to login
- Location: tests/functional/02_authentication.spec.ts:205:7

# Error details

```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e2]: 404 page not found
```

# Test source

```ts
  108 |     // Note: This test requires valid credentials
  109 |     // Skip if no test account available
  110 |   });
  111 | 
  112 |   // TC-042: Logout Functionality
  113 |   test('TC-042: Logout button is visible when logged in', async ({ page }) => {
  114 |     // Requires authenticated session
  115 |   });
  116 | 
  117 |   // TC-043: Session Timeout
  118 |   test('TC-043: Session timeout handling', async ({ page }) => {
  119 |     // Requires authenticated session
  120 |   });
  121 | 
  122 |   // TC-044: CSRF Token
  123 |   test('TC-044: CSRF token is present in form', async ({ page }) => {
  124 |     await page.goto(LOGIN_URL);
  125 |     const csrfToken = page.locator('input[name="_csrf"], input[name="csrf"]').first();
  126 |     if (await csrfToken.count() > 0) {
  127 |       const token = await csrfToken.getAttribute('value');
  128 |       expect(token).toBeTruthy();
  129 |     }
  130 |   });
  131 | 
  132 |   // TC-045: Password Minimum Length
  133 |   test('TC-045: Password minimum length validation', async ({ page }) => {
  134 |     await page.goto(LOGIN_URL);
  135 |     await page.fill('input[type="email"]', 'test@example.com');
  136 |     await page.fill('input[type="password"]', '123');
  137 |     await page.click('button[type="submit"]');
  138 |     await page.waitForTimeout(500);
  139 |   });
  140 | 
  141 |   // TC-046: Multiple Login Attempts
  142 |   test('TC-046: Multiple failed login attempts show warning', async ({ page }) => {
  143 |     await page.goto(LOGIN_URL);
  144 |     for (let i = 0; i < 3; i++) {
  145 |       await page.fill('input[type="email"]', 'test@example.com');
  146 |       await page.fill('input[type="password"]', 'wrongpassword');
  147 |       await page.click('button[type="submit"]');
  148 |       await page.waitForTimeout(1000);
  149 |     }
  150 |   });
  151 | 
  152 |   // TC-047: Email Case Sensitivity
  153 |   test('TC-047: Email is not case-sensitive', async ({ page }) => {
  154 |     await page.goto(LOGIN_URL);
  155 |     await page.fill('input[type="email"]', 'TEST@EXAMPLE.COM');
  156 |     await page.fill('input[type="password"]', 'password123');
  157 |     await page.click('button[type="submit"]');
  158 |     await page.waitForTimeout(1000);
  159 |   });
  160 | 
  161 |   // TC-048: Special Characters in Password
  162 |   test('TC-048: Special characters in password work', async ({ page }) => {
  163 |     await page.goto(LOGIN_URL);
  164 |     await page.fill('input[type="email"]', 'test@example.com');
  165 |     await page.fill('input[type="password"]', 'P@ssw0rd!#$%');
  166 |     await page.click('button[type="submit"]');
  167 |     await page.waitForTimeout(1000);
  168 |   });
  169 | 
  170 |   // TC-049: Login Page Branding
  171 |   test('TC-049: Login page has temple branding', async ({ page }) => {
  172 |     await page.goto(LOGIN_URL);
  173 |     const branding = page.locator('[class*="logo"], [class*="brand"], img').first();
  174 |     await expect(branding).toBeVisible();
  175 |   });
  176 | 
  177 |   // TC-050: Keyboard Navigation on Login
  178 |   test('TC-050: Tab navigation works on login form', async ({ page }) => {
  179 |     await page.goto(LOGIN_URL);
  180 |     await page.keyboard.press('Tab');
  181 |     const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
  182 |     expect(focusedElement).toBeTruthy();
  183 |   });
  184 | 
  185 |   // TC-051: Enter Key Submits Form
  186 |   test('TC-051: Pressing Enter submits login form', async ({ page }) => {
  187 |     await page.goto(LOGIN_URL);
  188 |     await page.fill('input[type="email"]', 'test@example.com');
  189 |     await page.fill('input[type="password"]', 'password123');
  190 |     await page.keyboard.press('Enter');
  191 |     await page.waitForTimeout(2000);
  192 |   });
  193 | 
  194 |   // TC-052: Loading State During Login
  195 |   test('TC-052: Loading state shows during login', async ({ page }) => {
  196 |     await page.goto(LOGIN_URL);
  197 |     await page.fill('input[type="email"]', 'test@example.com');
  198 |     await page.fill('input[type="password"]', 'password123');
  199 |     await page.click('button[type="submit"]');
  200 |     const loadingSpinner = page.locator('[class*="spinner"], [class*="loading"]').first();
  201 |     await page.waitForTimeout(500);
  202 |   });
  203 | 
  204 |   // TC-053: Unauthorized Access - Admin shows loading then redirects to login (client-side auth)
  205 |   test('TC-053: Accessing admin page without auth shows loading then redirects to login', async ({ page }) => {
  206 |     await page.goto(`${BASE_URL}/admin`);
  207 |     // Wait for Firebase auth to check and redirect to login
> 208 |     await page.waitForURL(/\/login/, { timeout: 10000 });
      |                ^ TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
  209 |     const url = page.url();
  210 |     expect(url).toMatch(/\/login/);
  211 |   });
  212 | 
  213 |   // TC-054: Already Logged In Redirect
  214 |   test('TC-054: Logged in user accessing login page redirects', async ({ page }) => {
  215 |     // Requires authenticated session
  216 |   });
  217 | 
  218 |   // TC-055: Password Field Autocomplete
  219 |   test('TC-055: Password field has correct autocomplete', async ({ page }) => {
  220 |     await page.goto(LOGIN_URL);
  221 |     const passwordField = page.locator('input[type="password"]').first();
  222 |     const autocomplete = await passwordField.getAttribute('autocomplete');
  223 |     expect(autocomplete).toBe('current-password');
  224 |   });
  225 | });
  226 | 
```