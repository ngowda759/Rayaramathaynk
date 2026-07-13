# Playwright Test Execution Report
Generated: 2026-07-13 07:11:57

## Execution Summary

| Metric | Value |
|--------|-------|
| Total Tests | 23 |
| Passed | 6 |
| Failed | 17 |
| Skipped | 0 |
| Pass Rate | 26.1% |
| Duration | 53.05 seconds |
| Browser | Chromium |
| Environment | https://work-2-yehrroerabrftaxm.prod-runtime.all-hands.dev |

## Module Coverage

| Module | Total | Passed | Failed |
|--------|-------|--------|--------|
| Homepage | 5 | 1 | 4 |
| Authentication | 4 | 0 | 4 |
| Seva Booking | 3 | 2 | 1 |
| Donation | 2 | 0 | 2 |
| Events | 1 | 0 | 1 |
| Gallery | 1 | 0 | 1 |
| About | 1 | 0 | 1 |
| Mobile Responsive | 2 | 1 | 1 |
| Accessibility | 2 | 1 | 1 |
| Security | 2 | 1 | 1 |

## Bugs Identified

| Bug ID | Severity | Module | Description |
|--------|----------|--------|-------------|
| BUG-001 | Critical | Homepage | Homepage returns 502 error - server not accessible |
| BUG-002 | Critical | Authentication | Login page returns 502 error |
| BUG-003 | Critical | Seva Booking | Sevas page returns 502 error |
| BUG-004 | Critical | Donation | Donation page returns 502 error |
| BUG-005 | Critical | Events | Events page returns 502 error |
| BUG-006 | Critical | Gallery | Gallery page returns 502 error |
| BUG-007 | Critical | About | About page returns 502 error |

## Detailed Test Results

### Failed Tests (17)

| Test ID | Module | Test Name | Reason |
|---------|--------|-----------|--------|
| TC-001 | Homepage | Homepage loads successfully | 502 Bad Gateway |
| TC-002 | Homepage | Page has title | Page not loaded - 502 error |
| TC-003 | Homepage | Navigation menu is visible | Page not loaded - 502 error |
| TC-004 | Homepage | Footer is present | Page not loaded - 502 error |
| TC-006 | Authentication | Login page loads | 502 Bad Gateway |
| TC-007 | Authentication | Login form has email and password fields | Page not loaded - 502 error |
| TC-008 | Authentication | Submit button is present | Page not loaded - 502 error |
| TC-009 | Authentication | Password field has correct type | Page not loaded - 502 error |
| TC-010 | Seva Booking | Sevas page loads | 502 Bad Gateway |
| TC-013 | Donation | Donation page loads | 502 Bad Gateway |
| TC-014 | Donation | Donation form is visible | Page not loaded - 502 error |
| TC-015 | Events | Events page loads | 502 Bad Gateway |
| TC-016 | Gallery | Gallery page loads | 502 Bad Gateway |
| TC-017 | About | About page loads | 502 Bad Gateway |
| TC-019 | Mobile Responsive | Login page renders on mobile viewport | Page not loaded - 502 error |
| TC-021 | Accessibility | Page has proper heading hierarchy | Page not loaded - 502 error |
| TC-022 | Security | Password field has correct type on login | Page not loaded - 502 error |

### Passed Tests (6)

| Test ID | Module | Test Name |
|---------|--------|-----------|
| TC-005 | Homepage | Page loads within acceptable time |
| TC-011 | Seva Booking | Sevas page has content |
| TC-012 | Seva Booking | Sevas page loads within acceptable time |
| TC-018 | Mobile Responsive | Homepage renders on mobile viewport |
| TC-020 | Accessibility | Images have alt attributes |
| TC-023 | Security | No sensitive data in URL on login |

## Recommendations

1. **Server Availability**: The primary issue is that the application servers are returning 502 Bad Gateway errors. Please verify:
   - The application servers are running
   - Network connectivity is working
   - The servers are properly configured to handle requests

2. **Environment Verification**: Ensure the test environment URL is correct and accessible.

3. **Re-run Tests**: Once the server issues are resolved, re-run these tests to get accurate pass/fail metrics.
