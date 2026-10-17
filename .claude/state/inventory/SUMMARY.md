# Inventory Summary

Generated: 2026-09-19

## Chunks

| Chunk | Title | Files | Lines |
|---|---|---:|---:|
| M01 | App shell, design tokens, shared UI kit and utilities | 90 | 10910 |
| M02 | Public site - home and information pages | 76 | 16488 |
| M03 | Public site - devotional content, bookings, donations and member pages | 51 | 10054 |
| M04 | Authentication, users, roles and security rules | 41 | 4806 |
| M05 | Admin console - shell, dashboard, CRUD framework and settings | 88 | 12516 |
| M06 | Admin console - content, events, gallery, media and library | 75 | 11790 |
| M07 | Admin console - sevas, bookings, poojas, aaradhane, donations, billing, receipts, calendar | 68 | 9925 |
| M08 | Raya AI - retrieval engine, intents, prompts, provider and chat API | 96 | 18325 |
| M09 | Raya AI - chat UI, admin AI console, knowledge workflow and AI UAT | 58 | 19108 |
| M10 | Service layer and type catalogue - the repository pattern as built | 102 | 21155 |
| M11 | Data model, Firestore/Supabase persistence, rules, indexes, seeds and the Supabase migration | 111 | 15841 |
| M12 | API routes and server actions - the full HTTP surface | 101 | 6818 |
| M13 | Device capabilities, notifications, location, QR, share, i18n and offline/PWA behaviour | 114 | 11850 |
| M14 | Domain engines - Panchanga calendar and festivals, Aaradhane generator, receipt PDFs, proof reports | 62 | 13386 |
| M15 | Testing, CI/CD, deployment, tooling, project history and documentation health | 241 | 66561 |

## Unassigned

21 files under app, components, services, lib, hooks, types, context, utils, data, seed, scripts, tests are not owned by any chunk.

- components/admin/AdminHeader.tsx (31 lines)
- components/admin/AdminSidebar.tsx (177 lines)
- components/admin/DashboardCard.tsx (34 lines)
- components/admin/RichTextEditor.tsx (235 lines)
- components/analytics/PageViewTracker.tsx (55 lines)
- components/debug/ClientEnvDebug.tsx (22 lines)
- lib/utils/firebase-key-parser.ts (41 lines)
- scripts/apply-ai-knowledge-migration.mjs (139 lines)
- scripts/diagnose-supabase-connectivity.ts (217 lines)
- scripts/diagnostic-sevaBookings.ts (34 lines)
- scripts/export-events.ts (97 lines)
- scripts/fetch-checkpoint.ts (135 lines)
- scripts/generate-events-firestore.ts (345 lines)
- scripts/import-events.ts (93 lines)
- scripts/read-firestore-counts.ts (127 lines)
- scripts/resolve-baseline-raya-ai.mjs (166 lines)
- scripts/test-boundary.sh (41 lines)
- scripts/tests/migration-runner.test.ts (94 lines)
- scripts/update-finance-settings.js (133 lines)
- scripts/update-finance-settings.ts (114 lines)
- scripts/verify-supabase-migrations.ts (269 lines)

## Assigned to more than one chunk

234 files are claimed by 2+ chunks (allowed).

- .github/workflows/aaradhane.yml: M14, M15
- .github/workflows/ai-uat.yml: M09, M15
- .github/workflows/panchanga.yml: M14, M15
- app/(public)/notifications/page.tsx: M02, M13
- app/(public)/pages/notifications/page.tsx: M02, M13
- app/(public)/qr/page.tsx: M03, M13
- app/api/admin/aaradhane/[id]/route.ts: M07, M12
- app/api/admin/aaradhane/route.ts: M07, M12
- app/api/admin/analytics/route.ts: M09, M12
- app/api/admin/content/route.ts: M09, M12
- app/api/admin/knowledge/[id]/route.ts: M09, M12
- app/api/admin/knowledge/route.ts: M09, M12
- app/api/admin/prompts/[id]/publish/route.ts: M09, M12
- app/api/admin/prompts/[id]/route.ts: M09, M12
- app/api/admin/prompts/route.ts: M09, M12
- app/api/admin/quotes/[id]/route.ts: M06, M12
- app/api/admin/quotes/bulk/route.ts: M06, M12
- app/api/admin/quotes/cache/route.ts: M06, M12
- app/api/admin/quotes/route.ts: M06, M12
- app/api/admin/quotes/seed/route.ts: M06, M12
- app/api/admin/receipt-sevas/[id]/route.ts: M07, M12
- app/api/admin/receipt-sevas/route.ts: M07, M12
- app/api/admin/receipts/[id]/pdf/route.ts: M07, M12
- app/api/admin/receipts/[id]/route.ts: M07, M12
- app/api/admin/receipts/[id]/send/route.ts: M07, M12
- app/api/admin/receipts/route.ts: M07, M12
- app/api/admin/temple-areas/[id]/route.ts: M06, M12
- app/api/admin/temple-areas/route.ts: M06, M12
- app/api/admin/users/create-admin/route.ts: M04, M12
- app/api/admin/users/set-role/route.ts: M04, M12
- app/api/ai/analytics/health/route.ts: M08, M12
- app/api/ai/analytics/intent-distribution/route.ts: M08, M12
- app/api/ai/analytics/latency/route.ts: M08, M12
- app/api/ai/analytics/route.ts: M08, M12
- app/api/ai/analytics/token-usage/route.ts: M08, M12
- app/api/ai/analytics/unknown-questions/route.ts: M08, M12
- app/api/ai/health/route.ts: M08, M12
- app/api/ai/knowledge/coverage/route.ts: M08, M12
- app/api/ai/knowledge/import/route.ts: M08, M12
- app/api/ai/multi-source/overview/route.ts: M08, M12
- app/api/ai/multi-source/query/route.ts: M08, M12
- app/api/ai/multi-source/quick-queries/route.ts: M08, M12
- app/api/ai/multi-source/statistics/route.ts: M08, M12
- app/api/ai/multi-source/today/route.ts: M08, M12
- app/api/ai/public-settings/route.ts: M08, M12
- app/api/ai/settings/ai-behavior/route.ts: M08, M12
- app/api/ai/settings/ai-responses/route.ts: M08, M12
- app/api/ai/settings/intents/route.ts: M08, M12
- app/api/ai/settings/policies/route.ts: M08, M12
- app/api/ai/settings/prompts/route.ts: M08, M12
- app/api/ai/settings/route.ts: M08, M12
- app/api/ai/settings/temple-information/route.ts: M08, M12
- app/api/ai/settings/unknown-questions/route.ts: M08, M12
- app/api/ai/settings/visitor-information/route.ts: M08, M12
- app/api/announcements/[id]/route.ts: M06, M12
- app/api/announcements/route.ts: M06, M12
- app/api/bookings/[id]/route.ts: M07, M12
- app/api/bookings/route.ts: M07, M12
- app/api/chat/route.ts: M08, M12
- app/api/dashboard/daily-spiritual/route.ts: M05, M12, M14
- app/api/donations/[id]/route.ts: M07, M12
- app/api/donations/route.ts: M07, M12
- app/api/events/[id]/route.ts: M06, M12
- app/api/events/route.ts: M06, M12
- app/api/gallery/local-assets/route.ts: M06, M12
- app/api/knowledge/article/[slug]/route.ts: M09, M12
- app/api/knowledge/categories/route.ts: M09, M12
- app/api/knowledge/route.ts: M09, M12
- app/api/knowledge/search/route.ts: M09, M12
- app/api/knowledge/workflow/approvals/route.ts: M09, M12
- app/api/knowledge/workflow/articles/[id]/route.ts: M09, M12
- app/api/knowledge/workflow/articles/route.ts: M09, M12
- app/api/knowledge/workflow/audit/route.ts: M09, M12
- app/api/knowledge/workflow/comments/route.ts: M09, M12
- app/api/knowledge/workflow/drafts/route.ts: M09, M12
- app/api/knowledge/workflow/statistics/route.ts: M09, M12
- app/api/knowledge/workflow/versions/[id]/route.ts: M09, M12
- app/api/public/receipts/route.ts: M07, M12
- app/api/reports/list/route.ts: M05, M12
- app/api/reports/save/route.ts: M05, M12
- app/api/revalidate/route.ts: M06, M12
- app/api/seed-ai-settings/route.ts: M08, M12
- app/api/storage/videos/route.ts: M06, M12
- app/api/supabase-check/route.ts: M04, M11, M12
- app/api/temple-areas/[id]/route.ts: M06, M12
- app/api/temple-areas/route.ts: M06, M12
- app/api/testimonials/route.ts: M06, M12
- context/AuthContext.tsx: M01, M04
- context/ProfileContext.tsx: M01, M04
- data/calendar.ts: M11, M14
- data/poojas.ts: M03, M11
- data/sevas.ts: M03, M11
- data/shlokas.ts: M03, M11
- data/timings.ts: M03, M11
- firestore.rules: M04, M11
- hooks/a11y/index.ts: M01, M13
- hooks/useAuth.ts: M01, M04
- hooks/useCrudTable.ts: M01, M05
- hooks/useDonationNotifications.ts: M01, M03
- hooks/useFinanceSettings.ts: M01, M05
- hooks/useGallery.ts: M01, M02
- hooks/useHomepage.ts: M01, M02
- hooks/useInViewAnimation.ts: M01, M02
- hooks/useReducedMotion.ts: M01, M13
- lib/admin-firebase.ts: M01, M10
- lib/auth.ts: M01, M04
- lib/crud-columns.tsx: M01, M05
- lib/date.ts: M01, M14
- lib/festival-utils.ts: M01, M14
- lib/firebase-admin-rest.ts: M01, M10
- lib/firebase.ts: M01, M10
- lib/gallery.ts: M01, M06
- lib/options.ts: M01, M03
- lib/panchanga-cache.ts: M01, M14
- lib/rate-limit.ts: M01, M12
- lib/sevas.ts: M01, M03
- lib/supabase/admin.ts: M04, M11
- lib/supabase/client.ts: M04, M11
- lib/supabase/migration-coverage.ts: M04, M11
- lib/supabase/migration-helpers.ts: M04, M11
- lib/supabase/migration-inventory.ts: M04, M11
- lib/supabase/migration-mappers.ts: M04, M11
- lib/supabase/migration-runner.ts: M04, M11
- lib/supabase/server.ts: M04, M11
- package.json: M01, M15
- scripts/migrate-ai-to-supabase.ts: M08, M11
- scripts/seed-ai-knowledge.ts: M08, M11
- scripts/seed-ai-settings.ts: M08, M11
- seed/ai/about-trust.json: M08, M11
- seed/ai/accommodation.json: M08, M11
- seed/ai/brindavana.json: M08, M11
- seed/ai/contact.json: M08, M11
- seed/ai/donation.json: M08, M11
- seed/ai/dress-code.json: M08, M11
- seed/ai/facilities.json: M08, M11
- seed/ai/faq.json: M08, M11
- seed/ai/history.json: M08, M11
- seed/ai/parking.json: M08, M11
- seed/ai/photography.json: M08, M11
- seed/ai/raghavendra-swamy.json: M08, M11
- seed/ai/temple-timings.json: M08, M11
- seed/ai/visitor-guidelines.json: M08, M11
- seed/ai/volunteer.json: M08, M11
- services/aaradhane.service.ts: M10, M14
- services/ai-analytics.service.ts: M08, M10
- services/analytics.service.ts: M10, M15
- services/announcement.service.ts: M02, M10
- services/auth.service.ts: M04, M10
- services/billing.service.ts: M07, M10
- services/chat.service.ts: M08, M10
- services/content.service.ts: M02, M10
- services/conversation.service.ts: M08, M10
- services/daily-spiritual.service.ts: M10, M14
- services/dashboard.service.client.ts: M05, M10
- services/dashboard.service.ts: M05, M10
- services/device-analytics.service.ts: M10, M13
- services/donation.service.ts: M03, M10
- services/donationCampaign.service.ts: M03, M10
- services/event.service.ts: M02, M10
- services/gallery.service.ts: M02, M06, M10
- services/homepage.service.ts: M02, M10
- services/knowledge-workflow.service.ts: M09, M10
- services/knowledge.service.ts: M08, M10
- services/ml.service.ts: M08, M10
- services/multi-source-retrieval.service.ts: M08, M10
- services/pageviews.service.ts: M10, M15
- services/pooja.service.ts: M03, M10
- services/profile.service.ts: M03, M10
- services/proof-report/accessibility.service.ts: M10, M14
- services/proof-report/content-quality.service.ts: M10, M14
- services/proof-report/crawler.service.ts: M10, M14
- services/proof-report/database-export.service.ts: M10, M14
- services/proof-report/html-generator.service.ts: M10, M14
- services/proof-report/image-validator.service.ts: M10, M14
- services/proof-report/link-validator.service.ts: M10, M14
- services/proof-report/pdf-generator.service.ts: M10, M14
- services/proof-report/proof-report.service.ts: M10, M14
- services/proof-report/screenshot.service.ts: M10, M14
- services/proof-report/seed-reader.service.ts: M10, M14
- services/proof-report/seo.service.ts: M10, M14
- services/proof-report/temple-validator.service.ts: M10, M14
- services/quote.service.ts: M03, M10
- services/receipt.service.ts: M07, M10
- services/receiptSeva.service.ts: M07, M10
- services/recommendation.service.ts: M02, M10
- services/report.service.ts: M05, M10
- services/search.service.ts: M02, M10
- services/settings.service.ts: M05, M10
- services/seva.service.ts: M03, M10
- services/sevaBooking.service.ts: M03, M10
- services/storage.service.ts: M06, M10
- services/temple-areas.service.ts: M03, M10
- services/temple-areas.supabase.service.ts: M03, M10
- services/testimonial.service.ts: M02, M10
- services/user.service.ts: M04, M10
- services/ux.service.ts: M10, M13
- services/volunteer.service.ts: M02, M10
- storage.rules: M04, M11
- tests/ai-uat/ai-uat.spec.ts: M09, M15
- tests/ai-uat/ai-uat.test.ts: M09, M15
- tests/ai-uat/generate-report.ts: M09, M15
- tests/ai-uat/index.ts: M09, M15
- tests/ai-uat/run-uat-tests.ts: M09, M15
- tests/ai-uat/test-cases.ts: M09, M15
- types/aaradhane-generator.ts: M10, M14
- types/aaradhane.ts: M10, M14
- types/ai-analytics.ts: M08, M10
- types/ai-settings.ts: M08, M10
- types/ai.ts: M08, M10
- types/announcement.ts: M06, M10
- types/billing.ts: M07, M10
- types/calendar.ts: M10, M14
- types/crud.ts: M05, M10
- types/daily-spiritual.ts: M10, M14
- types/dashboard.ts: M05, M10
- types/device.ts: M10, M13
- types/donation.ts: M07, M10
- types/event.ts: M06, M10
- types/festival.ts: M10, M14
- types/finance.ts: M07, M10
- types/gallery.ts: M06, M10
- types/knowledge-workflow.ts: M09, M10
- types/knowledge.ts: M08, M10
- types/multi-source-retrieval.ts: M08, M10
- types/proof-report.ts: M10, M14
- types/quote.ts: M06, M10
- types/receipt-extensions.ts: M07, M10
- types/receipt.ts: M07, M10
- types/receiptSeva.ts: M07, M10
- types/report.ts: M10, M14
- types/settings.ts: M05, M10
- types/seva-booking.ts: M07, M10
- utils/redirect.ts: M01, M04
- vercel.json: M12, M15

## Reverse dependency hot-spots (top 30 most-imported local files)

| File | Importer count |
|---|---:|
| components/ui/button.tsx | 86 |
| lib/firebase.ts | 73 |
| components/admin/common/AdminPageHeader.tsx | 58 |
| components/ui/input.tsx | 40 |
| components/layout/Navbar.tsx | 29 |
| components/layout/Footer.tsx | 29 |
| lib/ai/intent/types.ts | 28 |
| components/ui/textarea.tsx | 24 |
| components/calendar/Breadcrumb.tsx | 23 |
| hooks/useAuth.ts | 23 |
| lib/utils.ts | 22 |
| lib/auth/admin-auth.ts | 22 |
| types/gallery.ts | 20 |
| lib/ai/ai-settings/index.ts | 19 |
| types/device.ts | 19 |
| services/quote.service.ts | 18 |
| lib/ai/knowledge/types.ts | 15 |
| components/ui/label.tsx | 15 |
| services/event.service.ts | 14 |
| components/ui/dialog.tsx | 14 |
| services/gallery.service.ts | 13 |
| context/AuthContext.tsx | 13 |
| components/admin/common/SearchBox.tsx | 13 |
| types/receipt.ts | 13 |
| types/proof-report.ts | 13 |
| components/ui/form/FormSection.tsx | 12 |
| types/event.ts | 11 |
| services/knowledge.service.ts | 11 |
| lib/supabase/admin.ts | 11 |
| types/ai-settings.ts | 11 |

## Totals

- Source files (.ts/.tsx/.js/.jsx/.mjs): 929
- Source lines: 178106
- 'use client' files: 314
- server-only files: 6
- data/panchanga files (counted only, not read): 730
- public/ files (listed only, not read): 68

## Notes

- Root matched nothing: data/firestore-dump
- Root matched nothing: test_plan.sh
- Root matched nothing: fix-websocket.ts
