# Seva Entry - from pull request to go-live

For: Nikhil, who builds on his fork, and the site owner, who runs the live website. Written 2026-10-20.
The step-by-step clicks are in `docs/seva/SETUP-GUIDE.md`; this page explains the order and what changes where.

## 1. Two worlds that never mix

| | Your test world (now) | The live world (after the merge) |
|---|---|---|
| Code | branch `feature/seva-entry` on your fork | the site owner's `main`, after he merges your pull request |
| Website | `http://localhost:3000` on your PC, or your own Vercel preview | the temple's live address on the site owner's Vercel |
| Database | your Supabase project `seva-test` | the site owner's live Supabase project |
| Sign-in | your Firebase project `seva-test-nikhil` | the site owner's live Firebase project |
| Settings and keys | `.env.local` on your PC (git-ignored) | the site owner's Vercel environment variables |
| People | you (001) and three test sign-ins (002-004) | the real staff, onboarded on the live site |
| Data | 90 days of demo receipts | starts empty |

**The code is the same in both worlds. Only the settings differ.** Nothing in the code has to change to "connect to the
real" Firebase and Supabase: the live website reads the site owner's settings from Vercel, and your PC keeps reading
your test settings from `.env.local`.

## 2. What happens to your test setup

- **It stays as it is.** The pull request carries code only. `.env.local`, the key file, the test sign-ins and the demo
  receipts never leave your PC or your test projects (git ignores them, and the demo seeder refuses any project but a
  test one).
- **Keep using it.** It is where Plan B (website booking with Cashfree test mode) and Plan C (the Android app) are built
  and tried, without touching the temple's real data.
- **Your test projects are free** (Supabase Free, Firebase Spark). A Supabase Free project pauses after a week without
  use; "Restore project" in its dashboard wakes it up.
- **Never** put the live keys on your PC, and never point `.env.local` at the live projects.

## 3. Order of go-live

1. **You:** open the pull request from your fork to the site owner's repository.
   It describes the module and links this page and `HANDOVER-NOTES.md`.
2. **Site owner:** reviews and merges. Vercel builds the live site with the new code. At this point `/seva` exists but
   cannot work yet: the live database has no seva tables.
3. **Site owner, SETUP-GUIDE Part B, in order:**
   - **B1** applies the new tables to the live Supabase (his "Deploy Supabase Migrations" workflow).
   - **B2** publishes the new `firestore.rules` in the live Firebase.
   - **B3** replaces and revokes the old, leaked Firebase key.
   - **B4** checks the Vercel settings listed there, including `NEXT_PUBLIC_SITE_URL` for the QR codes.
   - **B5** makes himself staff 001 on the live site (or makes you a super admin there).
   - **B6** and **B7** set up the two backup keys and the GitHub secrets; the first nightly backup should then show on
     the dashboard.
4. **The temple's settings, on the live site** (a super admin, about an hour):
   - **Settings > Receipts:** the temple name and address, Photo 1 and Photo 2, the footer, and the paper size.
   - **Seva settings:** the real sevas, codes and rates.
   - **Settings > Devotee lists:** the office proof-reads the Kannada; open each name and save it.
   - **The UPI id** for the counter (finance settings; super admin only).
   - **Staff and roles:** onboard the receptionists, the prasadam volunteers and the temple admins.
5. **The office proof-reads** every Kannada text: the list is in `HANDOVER-NOTES.md`.
6. **The counter PC at the temple** (SETUP-GUIDE A5): printer and paper size, a Windows password, disk encryption,
   install the app, register the PC as Counter 1, choose the Excel folder.
7. **One dry-run day:** real receipts on test paper, a cancel, a prasadam give, a day close. Check the dashboard and
   the Excel copy that evening.
8. **Go live.** Keep the paper receipt book at the counter for the first week, as the fallback.

## 4. Installing it as an app (PWA)

Seva Entry is an installable web app (a PWA): one app for every role, with no app store and no download size worth
mentioning. It needs the live address over https (Vercel provides that); for testing, `localhost` also works.

| Device | How to install | What you get |
|---|---|---|
| **Windows PC / laptop** (counter, office) | Open `https://<live address>/seva` in **Edge or Chrome** > the install icon in the address bar (or menu > Apps > Install Seva Entry) | Its own window and taskbar icon. Opens on the right screen for whoever signs in. The counter keeps working offline |
| **Android phone** (prasadam volunteer, admins) | Open the same address in **Chrome** > menu > **Install app** (or Add to Home screen) | A home-screen icon that opens full screen, like an app |
| **iPhone / iPad** | Open it in **Safari** > Share > **Add to Home Screen** | A home-screen icon that opens full screen |

- **Updates arrive by themselves:** when the site owner's site is updated, the app picks up the new version the next
  time it opens. Nothing to reinstall.
- **A Play Store listing for staff is possible later**, by wrapping this same app (a "Trusted Web Activity"), if the
  temple ever wants it. It is not needed to use it.
- **Plan C** is a different app: the **devotees'** Android app for booking and paying. Staff keep using this one.

## 5. What can go wrong, and what to do

| Situation | What to do |
|---|---|
| The live site shows Seva Entry but every page errors after the merge | B1 (tables) or B4 (settings) is not done yet |
| Nobody can see the Seva Entry menu | B5 (staff 001) is not done, or that person is not onboarded as staff |
| The counter says "the temple's server did not answer" | Internet or server trouble: print offline; the receipts send by themselves later |
| The UPI QR is missing at the counter | Set the UPI id (super admin, finance settings) |
| The test website on your PC stopped working | Your Supabase test project paused: restore it in the Supabase dashboard |
