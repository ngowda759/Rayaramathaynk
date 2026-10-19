# Seva Entry - hand-over notes

Written 2026-10-20 (Tuesday) at the end of Phase 1 (plan A, task A5-2). Three lists for after the merge: the Kannada
text the temple office must check before go-live, the problems found while testing that belong to the rest of the
website, not to Seva Entry, and the small Seva Entry follow-ups not built in Phase 1.

## Kannada proof-read list (O-03)

None of the Kannada below has been checked by a native reader from the temple. Until the office has read it, every
slip and screen may carry a spelling the temple would not use. Each item names the file that holds the text; a
temple admin can correct the gotra, nakshatra and rashi names on the **Lists** page (`/seva/settings/lists`) without a
code change, and everything else is a one-line change in the file named.

| # | What to check | Where it lives | Notes |
|---|---|---|---|
| 1 | Every Kannada string of the module's screens (counter, today's receipts, close day, prasadam, dashboard, register, reports, settings, staff, export, the module's header and menus) | `lib/seva/strings/common.ts`, `lib/seva/strings/counter.ts`, `lib/seva/strings/today.ts`, `lib/seva/strings/dayclose.ts`, `lib/seva/strings/prasadam.ts`, `lib/seva/strings/dashboard.ts`, `lib/seva/strings/reports.ts`, `lib/seva/strings/settings.ts`, `lib/seva/strings/receipt-settings.ts`, `lib/seva/strings/lists.ts`, `lib/seva/strings/staff.ts`, `lib/seva/strings/export.ts`, `lib/seva/strings/shell.ts` | Kannada is always the line under the English; the English stays as it is |
| 2 | The gotra list: 56 gotras plus "Not known" | `lib/seva/domain/gotras.ts` (the seed); the live names are in the table `seva_list_items` and are edited on the Lists page | The Kannada spellings are unsourced; the file says so |
| 3 | Nakshatras 25 and 26: Purva Bhadrapada ಪೂರ್ವಾಭಾದ್ರ and Uttara Bhadrapada ಉತ್ತರಾಭಾದ್ರ | `lib/seva/domain/nakshatras.ts` (the seed); the Lists page corrects the Kannada | Madhwa usage often writes ಪೂರ್ವಾಭಾದ್ರಪದ / ಉತ್ತರಾಭಾದ್ರಪದ; the other 25 nakshatras and the 12 rashis (`lib/seva/domain/rashis.ts`) need a quick read too |
| 4 | The receipt words: Receipt No. ರಸೀದಿ ಸಂಖ್ಯೆ, Seva date ಸೇವಾ ದಿನಾಂಕ, Name ಹೆಸರು, Gotra ಗೋತ್ರ, Nakshatra ನಕ್ಷತ್ರ, Rashi ರಾಶಿ, Total ಒಟ್ಟು, Cash ನಗದು, Cancelled ರದ್ದು | `lib/seva/strings/common.ts` (printed by `components/seva/slip/ReceiptSlip.tsx` through `lib/seva/print/slip-model.ts`); the receipt page and history words in `lib/seva/strings/receipt.ts` | These print on every slip |
| 5 | ನಕಲು, the word in the DUPLICATE band of a reprinted slip, and "ನಕಲು ಮುದ್ರಿಸಿ" (Print a duplicate) | `lib/seva/strings/common.ts` (`duplicate`), `lib/seva/strings/receipt.ts` | Confirm the office uses ನಕಲು for a duplicate copy |
| 6 | The prasadam line on the slip: "Show this at the prasadam counter" ಪ್ರಸಾದ ಕೌಂಟರ್‌ನಲ್ಲಿ ತೋರಿಸಿ | `lib/seva/strings/common.ts` (`showAtPrasadam`) | Printed under the QR code |
| 7 | "Karnike" or "Kanike": the any-amount seva is written "Other Seva / Karnike" in English and ಇತರೆ ಸೇವೆ / ಕಾಣಿಕೆ in Kannada | `lib/seva/strings/settings.ts` (`anyAmount`, `otherSevaNote`) | The Kannada ಕಾಣಿಕೆ reads "Kanike", the usual English spelling elsewhere on the site; the office decides which English spelling the seva list uses |
| 8 | The temple header, footer lines and the blessing ಶ್ರೀ ಗುರುರಾಜೋ ವಿಜಯತೇ | Seeded as SAMPLE text by `supabase/migrations/20261020000200_seva_seed.sql`; edited in **Settings - Receipts** | The office sends the real temple name, address and photos (D29) |
| 9 | The Kannada seva names | Entered by a temple admin in **Sevas** (`/seva/seva-settings`) | The real list comes from the office |

When the office has read them: correct what they mark, then a temple admin opens the Lists page once so every
Kannada list name is marked as checked.

## Issues for the site owner (found while testing; they also exist on `main`)

These were found while the site was tried on fresh test projects during the Phase 1 build. None is caused by Seva Entry, and each
one is already on the `main` branch, so Seva Entry does not fix them; they are listed so the site owner can plan them.

| # | Issue | What you see | Where | Suggested fix |
|---|---|---|---|---|
| 1 | No Firestore rule for the `profiles` collection | `ProfileService` gets "permission denied" in the browser console after sign-in | `firestore.rules` (no `match /profiles/{id}` block); `services/profile.service.ts` | Add a rule that lets a signed-in person read and write their own profile document, or stop reading the collection |
| 2 | The Content Security Policy `connect-src` lacks `https://*.supabase.co` | The AI chat's session calls fail with "Failed to fetch" | `next.config.ts` (the `Content-Security-Policy` header) and `proxy.ts` | Add `https://*.supabase.co` to `connect-src` in both places, or move those calls to the server |
| 3 | The announcements query needs a composite index | The home page's active announcements fail with "The query requires an index" | `services/announcement.service.ts` (`where("isActive", "==", true)` with `orderBy("createdAt", "desc")`) | Create the composite index (`isActive` ascending, `createdAt` descending) from the link in the error, or add it to `firestore.indexes.json` |
| 4 | The AI settings fail zod validation on an empty database | Raya AI settings pages and the chat log zod errors until settings exist | `lib/ai/ai-settings/validation.ts`, `lib/ai/ai-settings/service.ts` | Fall back to the defaults in `lib/ai/ai-settings/seed-data.ts` when no row exists, or run the settings seed on a new project |
| 5 | `lib/admin-firebase.ts` falls back to `applicationDefault()` | With no key configured, the server tries Google's default credentials and fails later with a confusing error instead of saying the key is missing | `lib/admin-firebase.ts` (the `applicationDefault()` branch) | Fail at once with a plain "Firebase admin key not configured" message (Seva Entry's own code already reads the key this way) |
| 6 | The public site has no sign-out | A person signed in on the public pages cannot sign out there; only the admin console and Seva Entry's header have Sign out | The public header and menu components under `components/layout/` | Add Sign out to the public header's account menu |

## Seva Entry follow-ups (not built in Phase 1)

| # | Follow-up | Today | Where |
|---|---|---|---|
| 1 | A link from each row on **Day closes** to that counter and day's Close day page | An admin who must reopen a closed day types the address `/seva/day-close?counterId=<n>&date=<YYYY-MM-DD>` by hand (`docs/seva/README.md`, "Reopen a closed day") | `components/seva/reports/DayCloseList.tsx`, `components/seva/reports/DayCloseDetail.tsx` |
