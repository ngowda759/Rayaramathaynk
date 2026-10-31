# F-A14 — Public API Security Audit

Security audit of the write endpoints **outside** `/api/admin/`, with fixes and regression
tests. Companion to F-A13 (the `/api/admin/**` census in
`docs/audits/PRODUCTION_SUPABASE_READINESS.md`).

- Repository: `ngowda759/Rayaramathaynk`
- Audit date: 2026-10-31
- Scope: `/api/events`, `/api/donations`, `/api/bookings`, `/api/testimonials`,
  `/api/profile/*`
- Out of scope: `/api/admin/**` (F-A13), RLS policy changes, schema/migrations, any
  production data.

> **No production record, policy, migration or deployment was modified.** Every change is
> application code plus tests. No Firestore dependency or fallback was introduced.

---

## 1. Executive summary

Every in-scope route was read handler-by-handler. The audit found **three High** and
**several Medium/Low** issues, dominated by one theme: *administrative operations were
mounted on public paths with no guard*, and *public submissions accepted unvalidated
bodies*.

The most serious finding is that the collection writes and the per-id write routes for
`events` and `donations` had **no authentication at all** — an anonymous caller could
create, overwrite or delete events and donations, and read any donation (donor contact
details) by id. The `bookings` routes were already guarded but let a caller choose their own
`userId` (filing bookings under someone else's account). No in-scope route validated its
request body with Zod; several also had no rate limit.

All confirmed issues are fixed on this branch and covered by a new regression suite
(`tests/unit/public-api-security.test.ts`, 40 tests). The legitimate public reads (published
events, approved testimonials) and public submissions (donations, bookings, testimonials,
profile writes) continue to work.

---

## 2. Findings by severity

| # | Finding | Severity | Status |
|---|---|---|---|
| F-A14-1 | `POST/PATCH/DELETE` on `/api/events` and `/api/events/[id]` had no authentication — anonymous create/overwrite/delete of events | **High** | Fixed |
| F-A14-2 | `GET/PATCH/DELETE` on `/api/donations/[id]` had no authentication — anonymous read of donor contact/payment data, and overwrite/delete of any donation | **High** | Fixed |
| F-A14-3 | `POST /api/bookings` trusted a caller-supplied `userId` — a booking could be filed under another devotee's account | **High** | Fixed |
| F-A14-4 | No in-scope write route validated its body (no Zod) — unbounded strings, negative/non-numeric amounts, missing required fields reached the service layer | **Medium** | Fixed |
| F-A14-5 | No rate limiting on any in-scope public write — unbounded spam/abuse of donations, bookings, testimonials | **Medium** | Fixed |
| F-A14-6 | `GET /api/events/[id]` returned *unpublished* events to anonymous callers (draft enumeration) | **Medium** | Fixed |
| F-A14-7 | `event.service` matched events on `firestore_id` only — a row keyed by its Supabase `id` was invisible to `getEvent`/`updateEvent`/`deleteEvent`, so an admin edit/delete could silently no-op | **Low** | Fixed |
| F-A14-8 | `event.service` update used `.single()`, which throws on a zero-row update instead of returning "not found" | **Low** | Fixed |
| F-A14-9 | `GET /api/bookings?user=<uid>` — the query string was ignored (the uid is taken from the token, which is correct), but the parameter was misleading | **Low** | Documented |
| F-A14-10 | `/api/profile/image` upload accepted any content type and size (the browser's 5 MB check was the only control) | **Low** | Fixed |

No confirmed IDOR remains. No confirmed privilege escalation remains. Mass assignment is
prevented by schema key-stripping plus server-forced fields (below).

---

## 3. What was correct before the audit (preserved)

- `GET /api/bookings` and all `/api/bookings/[id]` methods already required a verified token
  (`verifyBearerIdToken`) or an admin (`requireAdminUser`).
- `GET/POST /api/testimonials` and `/api/testimonials/devotee` already forced
  `approved: false` / `submittedBy: "public"` server-side, so a submitter could not
  self-publish.
- `/api/profile/*` already keyed every read and write on the verified token's `uid`, never on
  a body value.
- The donation and booking services already force privileged columns (`status`, receipt,
  collection, payment) server-side.

These behaviours are unchanged and are now pinned by tests so they cannot regress.

---

## 4. Fixes

### 4.1 Authentication on administrative public paths

`POST /api/events`, `PATCH/DELETE /api/events/[id]` and all of `/api/donations/[id]` now
call the same `requireAdminUser` guard the `/api/admin/**` routes use
(`lib/auth/admin-auth.ts`). There is **no** admin UI or service that calls these routes
(the admin console uses `/api/admin/events` via `eventService` and `/api/admin/donations`
via `donationService`), so no legitimate client breaks. The routes are kept — rather than
deleted — so the guard is explicit and a future caller cannot re-open the hole by accident.

### 4.2 Ownership on `/api/bookings`

The booking owner is now derived from the verified token when one is present; a
caller-supplied `userId` is ignored. Anonymous submissions are recorded under the reserved
`"anonymous"` key (the public form already sends `user?.uid || "anonymous"`, so this is
behaviour-preserving). `GET /api/bookings` and `GET /api/bookings/[id]` are scoped to the
token's uid; `[id]` returns `403` for a non-owner. `PATCH` is split: an admin may set
`status`/`payment`, while a devotee may only record a payment reference for **their own**
booking — the self-service body cannot set an arbitrary status.

### 4.3 Validation and mass-assignment control

New `lib/validation/public-submissions.ts` defines a Zod schema per body, and
`lib/validation/http.ts` parses it. `z.object` drops undeclared keys, so privileged fields
(`status`, `receiptNumber`, `collectedBy`, `approved`, `submittedBy`, `uid`, bookmark `id`
/`createdAt`) can no longer be smuggled in. Lengths are bounded; amounts must be positive
and finite; dates must parse; `preferredDate` must not be in the past; enums constrain
`status`, `paymentMode`, `rating`, locale and bookmark type. A non-JSON body is a `400`, not
a `500`.

### 4.4 Rate limiting

New `lib/api/public-rate-limit.ts` wraps the site's in-memory limiter with a `public:`
namespace. Anonymous submissions key on the client IP; authenticated ones key on the
verified uid, which cannot be forged. Limits: donations 20/min, bookings 20/min,
testimonials 10/min, events 30/min (create), profile writes 30–120/min, image upload
10/min. This is best-effort per instance — the same guarantee the existing seva routes
rely on — and is documented as defence-in-depth, not an authorization control.

### 4.5 Event reads

`GET /api/events` now returns only published events, and `GET /api/events/[id]` returns
`404` for an unpublished one, so drafts are not enumerable. `event.service` gained
`getPublishedEvent()` and now matches rows by `firestore_id` **or** Supabase `id`
(`rowIdFilter`), fixing F-A14-7/F-A14-8.

### 4.6 Profile image

`POST /api/profile/image` now rejects anything that is not a JPEG/PNG/WebP/GIF under 5 MB,
enforced server-side.

---

## 5. Regression tests

`tests/unit/public-api-security.test.ts` — 40 tests, two layers:

1. **Static census** over the 14 in-scope route files. Every exported method must be
   guarded (admin guard or verified token) or a documented public read; every public write
   must be body-validated and rate-limited; no in-scope route may import Firestore or the
   admin Firebase SDK. This is the part that fails if a new unguarded method is added.
2. **Behavioural** checks: anonymous access (401/403), authenticated user, admin
   authorization, cross-user ownership (403), invalid payloads (400), mass assignment
   (privileged keys absent from the service call), rate limiting (429), and the legitimate
   public read/submission paths.

The suite stubs the auth guards and services, so it exercises the route wiring directly
without Firebase/Supabase. A leak in the rate limiter's cleanup timer was also fixed
(`unref()`), so the suite exits cleanly.

---

## 6. Verification

| Check | Command | Result |
|---|---|---|
| Types | `npm run typecheck` | clean |
| Lint | `npm run lint` | 0 errors (pre-existing warnings only) |
| Unit tests | `npx jest tests/unit` | 211 suites / 2737 tests pass |
| Build | `npm run build` | success; all 14 in-scope routes compiled |
| New suite | `npx jest tests/unit/public-api-security.test.ts` | 40/40 pass |

Baseline before this change: 210 suites / 2697 tests. The delta is the new
`public-api-security` suite plus the corrected `event-service-supabase-reads` stub.

---

## 7. Backward compatibility

- **Public reads**: unchanged for published events and approved testimonials.
- **Public submissions**: donation, booking, testimonial and profile forms still work; their
  payloads already match the new schemas. Where a form omitted an optional field, the schema
  supplies a default.
- **Admin console**: unaffected — it never called the newly guarded routes.
- **Breaking change for external callers**: any script that used `POST /api/events`,
  `PATCH/DELETE /api/events/[id]` or `/api/donations/[id]` without an admin token will now
  receive `401`. These were unauthenticated administrative operations and should not have
  existed; no in-repo caller is affected.

---

## 8. Remaining limitations

- Rate limiting is per server instance (in-memory), not a distributed quota. A multi-instance
  deployment should back it with Redis/Upstash.
- `campaignId` on donations is free text in the schema while the column is `uuid`; the form
  sends `""`, and the service has always written it as-is. Left as-is to avoid a schema
  change; flagged for a follow-up.
- The `docs/audits/` F-A13 follow-ups (`temple-areas`, `analytics`, `content`) are separate
  and untouched.
- The `events` public-SELECT RLS policy (`20261105000000_events_public_select_policy.sql`) is
  still *prepared, not applied*; that is an owner action and out of scope here.
