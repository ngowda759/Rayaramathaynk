# Seva Entry - go-live checklist

A short checklist, in order. Tick each box. Where a step needs many clicks, it names the exact section of
`docs/seva/SETUP-GUIDE.md` to follow.

**Before you start, know this:**
- The code is the same on your PC and on the live website. Only the settings differ.
- Your test projects, test sign-ins and demo receipts stay on your side and never go live.
- Nothing in the code has to change to use the live Firebase and Supabase.

---

## Part 1 - You: send the code to the site owner

- [ ] 1. In the browser, open `https://github.com/nikhilmn01/Rayaramathaynk` and sign in to GitHub as `nikhilmn01`.
- [ ] 2. Click the **Pull requests** tab, then the green **New pull request** button.
- [ ] 3. At the top there are four drop-downs. Set them to:
  - **base repository:** `ngowda759/Rayaramathaynk`
  - **base:** `main`
  - **head repository:** `nikhilmn01/Rayaramathaynk`
  - **compare:** `main`
- [ ] 4. Click **Create pull request**.
- [ ] 5. In **Title**, type: `Seva Entry - digital seva counter, receipts, prasadam and dashboard`.
- [ ] 6. In the description, paste these three lines:
  - `Adds the Seva Entry module at /seva.`
  - `Go-live steps for the site owner: docs/seva/GO-LIVE.md (Part 2) and docs/seva/SETUP-GUIDE.md (Part B).`
  - `Known limits and the Kannada proof-read list: docs/seva/HANDOVER-NOTES.md.`
- [ ] 7. Click **Create pull request** again.
- [ ] 8. Copy the page's address from the browser bar and send it to the site owner, with: "Please follow Part 2 of
  docs/seva/GO-LIVE.md after merging."

## Part 2 - Site owner: make the live website ready

Each step below is written for him in `SETUP-GUIDE.md` Part B. Do them in this order.

- [ ] 9. **Merge** the pull request on GitHub: open it, then **Merge pull request**, then **Confirm merge**.
  - Vercel rebuilds the live website by itself in a few minutes.
  - Until steps 10 to 12 are done, `/seva` shows errors. That is expected.
- [ ] 10. **B1:** add the new tables to the live Supabase. He runs his "Deploy Supabase Migrations" workflow.
- [ ] 11. **B2:** publish the new `firestore.rules` in the live Firebase.
- [ ] 12. **B4:** check the live Vercel settings, including `NEXT_PUBLIC_SITE_URL`, the live address used in the
  receipt QR codes. Then redeploy.
- [ ] 13. **B3:** make a new Firebase key, put it in Vercel and GitHub, check the site, then delete the old, leaked
  key.
- [ ] 14. **B5:** make himself staff 001 on the live site. Or make you a super admin there: Staff and roles, then
  **Onboard staff**.
- [ ] 15. **B6:** each key holder (you and him) makes a backup key, as you chose.
- [ ] 16. **B7:** put both public backup keys and the database connection string into his GitHub secrets. The next
  morning, the dashboard should show a fresh backup.

## Part 3 - A super admin: fill in the temple's settings on the live site

Sign in at `https://<live address>/login`, then open `https://<live address>/seva`.

- [ ] 17. Menu **Settings**, tab **Receipts**:
  - temple name and address
  - **Photo 1 (left)** and **Photo 2 (right)**
  - footer lines
  - **Paper size** (A5, or the size of your printer's paper)

  Then click **Save settings**.
- [ ] 18. Menu **Seva settings**: click **+ Add seva** once for each real seva, with its code, English and Kannada name,
  rate, and whether it allows several dates. Delete nothing; hide what is not used.
- [ ] 19. Menu **Settings**, tab **Counters**: check that Counter 1 exists and set its opening cash float.
- [ ] 20. Menu **Settings**, tab **Denominations**: keep the notes and coins the temple uses.
- [ ] 21. Menu **Settings**, tab **Festival days**: add the coming festivals, such as Aradhane.
- [ ] 22. Set the UPI id the counter shows:
  1. Click **Website admin**.
  2. Click **Finance Settings**.
  3. Find **UPI Payment** and switch it on.
  4. Type the temple's UPI id and the payee name.
  5. Save.

  Only a super admin can change this.
- [ ] 23. Menu **Staff and roles**, then **Onboard staff**, once per person, with a name, an email address they can
  open, and a role:
  - **Receptionist:** the counter
  - **Prasadam counter:** the volunteers
  - **Temple admin:** the office, the trustees; tick view-only for a trustee who only looks

  Each person gets an email to set a password.

## Part 4 - The temple office: check the Kannada

- [ ] 24. Give the office the list in `docs/seva/HANDOVER-NOTES.md` (Kannada proof-read).
- [ ] 25. For the gotras, nakshatras and rashis, open menu **Settings**, tab **Devotee lists**:
  1. Open each name marked "not yet checked".
  2. Correct the Kannada if needed.
  3. Click **Save**, even if it is already right. That marks it checked.
- [ ] 26. Send me any other wrong Kannada (on the counter, slips or reports) and I correct it in the code.

## Part 5 - The counter PC at the temple

Follow `SETUP-GUIDE.md` section A5 for every click.

- [ ] 27. **A5.1:** give the counter's Windows account a password.
- [ ] 28. **A5.2:** turn on disk encryption.
- [ ] 29. **A5.3:** install the printer and set its paper to the size chosen in step 17.
- [ ] 30. **A5.4:** make it the default printer.
- [ ] 31. **A5.5:** stop Edge from running in the background.
- [ ] 32. **A5.6:** install the app, as in Part 6 below.
- [ ] 33. **A5.7:** make the kiosk-printing shortcut, so a receipt prints with one click and no print window.
- [ ] 34. **A5.8:**
  1. Sign in as a temple admin.
  2. Open Menu **Settings**, tab **Counters**, then **Register this PC** for Counter 1.
  3. On the counter, choose the folder for the daily Excel copy.

## Part 6 - Install Seva Entry as an app

The live address must start with `https://` (Vercel gives this).

**Windows PC or laptop (Edge or Chrome):**
- [ ] 35. Open `https://<live address>/seva` and sign in.
- [ ] 36. Click the **install icon** at the right end of the address bar. If there is none: menu **...**, then
  **Apps**, then **Install Seva Entry**.
- [ ] 37. Click **Install**. Seva Entry opens in its own window and gets a taskbar icon. Right-click the icon, then
  **Pin to taskbar**.

**Android phone (Chrome):**
- [ ] 38. Open `https://<live address>/seva` and sign in.
- [ ] 39. Tap the menu **⋮**, then **Install app** (or **Add to Home screen**), then **Install**.
- [ ] 40. Open it from the new icon on the home screen. It opens full screen.

**iPhone or iPad (Safari only):**
- [ ] 41. Open `https://<live address>/seva` in **Safari** and sign in.
- [ ] 42. Tap **Share** (the square with an arrow), scroll, tap **Add to Home Screen**, then **Add**.

**Updates arrive by themselves.** When the live site is updated, the app picks up the new version the next time it
opens.

## Part 7 - Dry run, then go live

- [ ] 43. **One dry-run day** at the counter, on plain paper:
  - make receipts (one with several dates, one cash, one UPI)
  - cancel one
  - mark prasadam given for one
  - close the day
- [ ] 44. That evening, check the dashboard, **Register** and **Day closes**, and open the Excel copy in the chosen
  folder.
- [ ] 45. Delete the dry-run receipts' effect the proper way: cancel them with the reason "Test". Receipts are never
  deleted.
- [ ] 46. **Go live.** Keep the paper receipt book at the counter for the first week as the fallback.

---

## Afterwards: your test setup

- **Keep it.** Your PC's `.env.local` still points at your test projects. Build and try Plan B and Plan C there.
- **If your test website stops working after a week of no use**, the free Supabase project has paused:
  1. Open `supabase.com/dashboard`.
  2. Open `seva-test`.
  3. Click **Restore project**.
- **Never put the live keys on your PC.**

## If something goes wrong

| What you see | What it means | What to do |
|---|---|---|
| `/seva` pages error after the merge | Steps 10-12 not done yet | Ask the site owner to finish B1, B2 and B4 |
| Nobody sees the Seva Entry menu | No staff yet | Do step 14 (staff 001), then step 23 |
| "The temple's server did not answer in time" at the counter | The internet or the server is down | Print offline; the receipts send by themselves later |
| No UPI QR at the counter | The UPI id is not set | Do step 22 |
| The app does not offer to install | The address is not https, or you are not on `/seva` | Use the live https address, open `/seva`, then try again |
