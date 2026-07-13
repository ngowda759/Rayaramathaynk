# Lint Test Report
Generated: 2026-07-13 07:20:32

## Executive Summary

| Metric | Count |
|--------|-------|
| **Total Issues** | 60 |
| **Errors** | 12 |
| **Warnings** | 48 |
| **Files with Issues** | 60 |

## Issue Breakdown by Type

| Category | Errors | Warnings |
|----------|--------|----------|
| other | 8 | 1 |
| @typescript-eslint | 2 | 35 |
| react | 2 | 0 |
| react-hooks | 0 | 10 |
| @next/next | 0 | 2 |

## Files with Issues

| File | Errors | Warnings |
|------|--------|----------|
| app/(public)/facilities/page.tsx | 1 | 0 |
| components/admin/layout/AdminAuthGuard.tsx | 1 | 0 |
| components/admin/settings/homepage/TestimonialsSection.tsx | 1 | 0 |
| components/auth/GuestOnly.tsx | 1 | 0 |
| components/chat/RayaBot.tsx | 1 | 0 |
| components/home/GalleryPreviewClient.tsx | 1 | 0 |
| components/home/Testimonials.tsx | 1 | 0 |
| context/AuthContext.tsx | 1 | 0 |
| hooks/useGallery.ts | 1 | 0 |
| hooks/useHomepage.ts | 1 | 0 |
| lib/firebase.ts | 1 | 0 |
| tests/functional/09_performance_security.spec.ts | 1 | 0 |
| app/(public)/aaradhane/page.tsx | 0 | 1 |
| app/(public)/donation/failure/page.tsx | 0 | 1 |
| app/admin/aaradhane/page.tsx | 0 | 1 |
| app/admin/announcements/page.tsx | 0 | 1 |
| app/admin/billing/page.tsx | 0 | 1 |
| app/admin/bookings/page.tsx | 0 | 1 |
| app/admin/donations/page.tsx | 0 | 1 |
| app/admin/events/page.tsx | 0 | 1 |
| app/admin/pooja/page.tsx | 0 | 1 |
| app/admin/reports/page.tsx | 0 | 1 |
| app/admin/settings/facilities/page.tsx | 0 | 1 |
| app/admin/sevas/page.tsx | 0 | 1 |
| app/admin/timings/page.tsx | 0 | 1 |
| components/admin/aaradhane/CreateAaradhane.tsx | 0 | 1 |
| components/admin/aaradhane/EditAaradhane.tsx | 0 | 1 |
| components/admin/common/AdminAssistant.tsx | 0 | 1 |
| components/admin/crud/CrudTable.tsx | 0 | 1 |
| components/admin/crud/CrudTableCell.tsx | 0 | 1 |
| components/admin/events/EventTable.tsx | 0 | 1 |
| components/admin/gallery/GalleryDashboard.tsx | 0 | 1 |
| components/admin/layout/AdminHeader.tsx | 0 | 1 |
| components/admin/layout/AdminSidebar.tsx | 0 | 1 |
| components/admin/layout/NotificationDropdown.tsx | 0 | 1 |
| components/admin/pooja/EditPooja.tsx | 0 | 1 |
| components/auth/LoginForm.tsx | 0 | 1 |
| components/auth/ProtectedRoute.tsx | 0 | 1 |
| components/auth/RegisterForm.tsx | 0 | 1 |
| components/home/DonationForm.tsx | 0 | 1 |
| components/home/EventCountdown.tsx | 0 | 1 |
| components/home/FullGallery.tsx | 0 | 1 |
| components/home/QuickServices.tsx | 0 | 1 |
| components/layout/Footer.tsx | 0 | 1 |
| components/ui/GoUpButton.tsx | 0 | 1 |
| hooks/useCrudTable.ts | 0 | 1 |
| lib/auth.ts | 0 | 1 |
| proxy.ts | 0 | 1 |
| scripts/seed-poojas.js | 0 | 1 |
| scripts/seed-sevas.js | 0 | 1 |
| scripts/update-finance-settings.js | 0 | 1 |
| tests/comprehensive_validation.spec.ts | 0 | 1 |
| tests/functional/02_authentication.spec.ts | 0 | 1 |
| tests/functional/03_admin_dashboard.spec.ts | 0 | 1 |
| tests/functional/06_donations.spec.ts | 0 | 1 |
| tests/functional/07_events_gallery_announcements.spec.ts | 0 | 1 |
| tests/functional/08_mobile_responsive.spec.ts | 0 | 1 |
| tests/functional/10_database_browser.spec.ts | 0 | 1 |
| tests/functional/comprehensive.spec.ts | 0 | 1 |
| utils/event.ts | 0 | 1 |

## Critical Issues (Errors)

### app/(public)/facilities/page.tsx:107
**ERROR**: A `require()` style import is forbidden            @typescript-eslint/no-require-imports

### components/admin/layout/AdminAuthGuard.tsx:69
**ERROR**: Error: Calling setState synchronously within an effect can trigger cascading renders

### components/admin/settings/homepage/TestimonialsSection.tsx:66
**ERROR**: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`  react/no-unescaped-entities

### components/auth/GuestOnly.tsx:32
**ERROR**: Error: Calling setState synchronously within an effect can trigger cascading renders

### components/chat/RayaBot.tsx:16
**ERROR**: Error: Calling setState synchronously within an effect can trigger cascading renders

### components/home/GalleryPreviewClient.tsx:37
**ERROR**: Error: This value cannot be modified

### components/home/Testimonials.tsx:189
**ERROR**: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`  react/no-unescaped-entities

### context/AuthContext.tsx:86
**ERROR**: Error: Calling setState synchronously within an effect can trigger cascading renders

### hooks/useGallery.ts:24
**ERROR**: Error: Calling setState synchronously within an effect can trigger cascading renders

### hooks/useHomepage.ts:14
**ERROR**: Error: Calling setState synchronously within an effect can trigger cascading renders

### lib/firebase.ts:115
**ERROR**: Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

### tests/functional/09_performance_security.spec.ts:325
**ERROR**: Parsing error: ',' expected


## Recommendations

### High Priority (Fix Errors First)
1. Fix all `react-hooks/set-state-in-effect` errors - these cause performance issues
2. Fix `react/no-unescaped-entities` errors - these are accessibility issues
3. Fix `react-hooks/incompatible-library` issues
4. Fix `require()` style imports in facilities/page.tsx

### Medium Priority
1. Add proper alt props to all images
2. Use `<Image />` from next/image instead of `<img>`
3. Fix missing dependencies in useEffect hooks
4. Remove unused imports and variables

### Low Priority
1. Clean up test files with unused variables
2. Address compilation skip warnings

---
*Report generated by ESLint*
