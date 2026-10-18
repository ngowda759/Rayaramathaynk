# Seva Entry - owner's setup guide

For: the owner of the temple website (Sri Raghavendra Swamy Matha). Written 2026-10-18 for Plan A (Phase 1).
Plans B and C add sections 8 and 9 later.

This guide is written for someone who has never used Supabase, Vercel, Google Cloud, GitHub secrets or `age`
before. Follow it one step at a time, top to bottom. You do not need to understand why a step is there; where it
matters, the reason is given in one line.

## 0. How to use this guide

### 0.1 What the marks mean

- **Bold words** are exactly what you will see on the screen: a button, a menu, a tab or a field name. Look for those
  words and click them.
- One numbered step = one action. Do it, then read the next step.
- A line that starts with "You should now see" tells you what the screen looks like after the step. If your screen
  looks different, stop and read 0.3.
- `Text in this font` is something you type or copy exactly as it is, letter for letter.
- `<something in angle brackets>` is a placeholder: type your own value there, without the angle brackets.
- UNVERIFIED means I could not confirm that exact screen or wording on the vendor's website on the day I wrote it.
  The step is still right in spirit; the button name may differ slightly. Look for the nearest match.
- Each platform section names the vendor pages I read, as `(source: <web address>, checked <date>)`. Vendors change
  their screens often; if a screen looks very different, the vendor has probably changed it since that date.

### 0.2 Secrets: the one rule that matters

A **secret** is anything that lets someone into the temple's systems: a password, a database connection string, a
"service role" or "secret" key, an access token, the Firebase key file (`.json`), and the backup key file
(`seva-backup-key.txt`).

- **Never paste a secret into chat** - not to me, not to anyone. I never need to see one.
- **Never paste a secret into git**, a document, an email, WhatsApp, or a screenshot.
- Secrets go only into these three places, and this guide shows you exactly where:
  1. **Vercel** environment variables (for the website),
  2. **GitHub** repository secrets (for the nightly backup and the scripts),
  3. git-ignored files on this PC (`.firebase-adminsdk.json` in the repository folder) or the two USB drives.
- Things that are **not** secret and that you may send me: a project ref (20 letters), a region name, a plan name,
  a database size, a key's creation date, and the "Section N done" messages at the end of each section.
- Take a screenshot for me only if no password, key or connection string is visible on it.

### 0.3 If something looks different or goes wrong

1. Stop. Do not click around to "fix" it.
2. Write down the step number you were on (for example "Section 1, step 1.2.4").
3. Copy any error text that has no password or key in it.
4. Tell me the step number and the error text. I will tell you what to do next.

### 0.4 How to open a PowerShell window in a folder

Some sections ask you to type a command. Do it like this:

1. Open **File Explorer** (the yellow folder icon on the taskbar).
2. Go to the folder the section names (for example `D:\Onboarding\Repos\POCs\seva-entry`).
3. Right-click an empty space inside the folder.
4. Click **Open in Terminal**.
   You should now see a dark window whose last line ends with the folder name and a `>` sign. Type commands there and
   press **Enter** after each one.

When a command asks for a password, the letters you type do not appear on screen. That is normal. Type it and press
**Enter**.

### 0.5 Which sections to do, and when

| Section | When | Time |
|---|---|---|
| 1. Supabase test project | Now (before the build reaches its test stage) | 30 min |
| 2. Vercel access and settings | Now | 20 min |
| 3. Revoke the old Firebase key | When I tell you the build is merged into main (see the reason in 3) | 30 min |
| 4. Backup secrets and the age key | Now; you need two USB drives | 30 min |
| 5. Restore drill | Once a month, first time before go-live | 20 min |
| 6. Local database tests | Nothing to do; read only | 2 min |
| 7. The counter PC | When I tell you the counter page is ready for the print test | 60 min |

### Tell me it is done

Send me this message in chat (it holds no secret): `Section 0 done - read`.

## 1. Supabase test project for the build

Why: the build must be tried on a separate, empty database first. The live database that the website uses today
stays untouched. Supabase's Free plan allows 2 active projects, so the live project plus this test project fit
exactly. (source: https://supabase.com/pricing, checked 2026-10-18)

What you need: your Supabase sign-in, this PC, about 30 minutes.

Vendor pages read for this section:
(source: https://supabase.com/docs/guides/platform/regions, checked 2026-10-18)
(source: https://supabase.com/docs/guides/deployment/managing-environments, checked 2026-10-18)
(source: https://supabase.com/docs/reference/cli/supabase-db-push, checked 2026-10-18)
(source: https://supabase.com/docs/reference/cli/supabase-login, checked 2026-10-18)
(source: https://supabase.com/docs/guides/local-development/cli/getting-started, checked 2026-10-18)
(source: https://supabase.com/docs/guides/platform/database-size, checked 2026-10-18)

### 1.1 Note the live project's size and region (read only)

This answers open items O-16 (region) and O-17 (database size). You only look; you change nothing.

1. Open `https://supabase.com/dashboard` in the browser and sign in.
   You should now see a list of your projects as cards.
2. Click the card of the **live** temple project (the one the website uses today).
   You should now see the project's home page with a left-hand menu of icons.
3. In the left-hand menu, click **SQL Editor**.
   You should now see a large empty text box with a **Run** button.
4. Click inside the text box and type exactly: `select pg_size_pretty(pg_database_size(current_database()));`
5. Click **Run**.
   You should now see one result row, such as `142 MB`. Write that number down. This query only reads; it changes
   nothing.
6. In the left-hand menu, click **Project Settings** (the gear icon at the bottom).
7. Look for the word **Region** on the **General** page. If it is not there, click **Infrastructure** in the settings
   menu and look there. (UNVERIFIED: Supabase shows the region on one of these two pages; the docs name the
   Infrastructure page at `/settings/infrastructure`.)
   You should now see a region such as **South Asia (Mumbai)** or **Southeast Asia (Singapore)**. Write it down.
8. Close the SQL Editor tab without saving. Do not touch anything else in the live project.

### 1.2 Create the test project

1. Go back to `https://supabase.com/dashboard`.
2. Click **New project**. (UNVERIFIED: the button may read **New Project** or sit under a **+** sign.)
   You should now see a form with **Organization**, **Project name**, **Database Password** and **Region**.
3. Under **Organization**, keep the same organization the live project is in.
4. In **Project name**, type `seva-test`.
5. Next to **Database Password**, click **Generate a password**. (UNVERIFIED label.)
6. Click **Copy** next to the password and save it in your password manager, or write it on paper that stays in the
   office. This is a secret: never paste it into chat. You will type it once more in step 1.4.7.
7. Under **Region**, choose **South Asia (Mumbai)**. The vendor's code for it is `ap-south-1`. A project's region
   cannot be changed later, so check this twice.
8. Leave every other option as it is.
9. Click **Create new project**.
   You should now see a "Setting up project" screen. Wait 2 to 3 minutes until the project's home page appears.

If Supabase says you have reached the limit of active projects, stop: you already have two active projects. Tell me
the names of your projects (names are not secret) and I will tell you which one can be paused.

### 1.3 Find the test project's ref

The **project ref** is the 20-letter name of a project. It is not a secret.

1. Look at the browser's address bar while the `seva-test` project is open.
   You should now see an address like `https://supabase.com/dashboard/project/abcdefghijklmnopqrst`.
2. Copy the 20 letters after `/project/`. That is the project ref. Write it down; you send it to me at the end.

### 1.4 Put the build's tables into the test project

You run three commands on this PC. They talk only to the `seva-test` project.

1. Open a PowerShell window in the folder `D:\Onboarding\Repos\POCs\seva-entry` (see 0.4).
2. Type `node -v` and press **Enter**.
   You should now see a version such as `v22.11.0`. The Supabase CLI needs version 20 or later. If you see a lower
   number or an error, stop and tell me.
3. Type `npx supabase login` and press **Enter**.
   You should now see either a question "Need to install the following packages ... Ok to proceed?" (type `y` and press
   **Enter**) or a message about opening the browser.
4. If it asks to open the browser, press **Enter**.
   You should now see a Supabase page in the browser asking you to allow the CLI.
5. Click **Authorize** (or the similar button) in that browser page.
   You should now see "You are now logged in" or "Finished supabase login" in PowerShell.
   (UNVERIFIED: the CLI may instead show a short verification code to type back into the PowerShell window, or ask
   "Enter your access token". If it asks for a token: open `https://supabase.com/dashboard/account/tokens`, click
   **Generate new token**, name it `seva-pc`, click **Copy**, click in the PowerShell window, press **Ctrl+V**, and
   press **Enter**. The token is a secret: never paste it into chat.)
6. Type `npx supabase link --project-ref <your project ref>` with the 20 letters from 1.3, and press **Enter**.
   You should now see "Enter your database password (or leave blank to skip)".
7. Type the test project's database password from step 1.2.6 (the letters stay invisible) and press **Enter**.
   You should now see "Finished supabase link".
8. Type `npx supabase db push --dry-run` and press **Enter**.
   You should now see a list of migration file names that would be applied, ending with names that contain `seva`.
   Nothing has been changed yet.
9. Type `npx supabase db push` and press **Enter**.
   You should now see the same list and a question "Do you want to push these migrations to the remote database?".
10. Type `Y` and press **Enter**.
   You should now see each file being applied and then "Finished supabase db push".
11. Close the PowerShell window.

If any step shows red error text, copy the last 20 lines (they do not contain your password) and send them to me with
the step number. Do not run the command again until I answer.

### Tell me it is done

Send me this message in chat (it holds no secret; fill in the brackets):
`Section 1 done - test ref <20 letters>, live region <region>, live size <size>`.

## 2. Vercel access and settings

Why: Vercel runs the website. The build needs the right settings names in the right place, and the website's code
should run near the database (Mumbai).

What you need: your Vercel sign-in, about 20 minutes.

Vendor pages read for this section:
(source: https://vercel.com/docs/rbac/managing-team-members, checked 2026-10-18)
(source: https://vercel.com/docs/environment-variables/managing-environment-variables, checked 2026-10-18)
(source: https://vercel.com/docs/environment-variables/sensitive-environment-variables, checked 2026-10-18)
(source: https://vercel.com/docs/functions/configuring-functions/region, checked 2026-10-18)
(source: https://vercel.com/docs/regions, checked 2026-10-18)
(source: https://vercel.com/docs/limits/fair-use-guidelines, checked 2026-10-18)
(source: https://vercel.com/docs/deployments/managing-deployments, checked 2026-10-18)
(source: https://vercel.com/docs/cli/login, checked 2026-10-18)

### 2.1 Check which Vercel plan you are on

1. Open `https://vercel.com/dashboard` and sign in.
   You should now see your projects, and at the top left a team name with a small label such as **Hobby** or **Pro**.
   (UNVERIFIED: the label's position.)
2. Click your team name, then **Settings**, then **Billing** if you cannot see the label.
3. Write down the plan name.

Two facts from Vercel's own pages that matter for the temple:

- **Hobby is for non-commercial personal use only.** Vercel counts "any method of requesting or processing payment
  from visitors of the site" as commercial; asking for donations is not. Phase 1 (the counter) takes no money on the
  website, but Phase 2 (online seva booking with payment) probably needs **Pro**. This is your decision (open item
  O-16); nothing changes today.
- **Inviting another person into the team is available only on Pro and Enterprise.** On Hobby, the builder works on
  this PC under your own sign-in instead (2.2). On Pro, you may also invite a person through **Settings** >
  **Members** > enter the email > choose a role > **Invite**.

### 2.2 Give the builder access on this PC

The builder (me) works on this PC. Signing in once here lets me read the project's settings names while I build.
I never deploy without your word.

1. Open a PowerShell window in the folder `D:\Onboarding\Repos\POCs\seva-entry` (see 0.4).
2. Type `npx vercel login` and press **Enter**.
   You should now see a question to install the package (type `y` and press **Enter**) and then a prompt or a browser
   page asking you to confirm the sign-in.
3. In the browser page, click the button that confirms the sign-in (for example **Confirm** or **Continue**).
   (UNVERIFIED: Vercel changed its CLI sign-in flow in 2025; the page wording may differ.)
   You should now see in PowerShell a line saying you are logged in, with your email.
4. Type `npx vercel whoami` and press **Enter**.
   You should now see your Vercel user name. Close the window.

### 2.3 Check the function region (Mumbai)

1. In the Vercel dashboard, click the temple website project (probably named **rayaramathaynk**; UNVERIFIED).
2. Click **Settings** in the sidebar.
3. Click **Functions** in the settings menu.
4. Open the **Function Regions** section.
   You should now see the selected region. New projects start in **Washington, D.C., USA (iad1)**.
5. Write down the region that is selected.
6. If it is not **Mumbai, India (bom1)**, do not change it yet. The live database's region (from 1.1.7) decides the
   best choice, and changing the region affects the live site. I will tell you whether to change it.

### 2.4 Add the settings names for the test build

Vercel keeps settings ("environment variables") separately for **Production** (the live website) and **Preview**
(test copies made from the build branch). The test build must point at the `seva-test` database, never the live one.

Where each value comes from:

| Name | Production (live site) | Preview (test build) | Type |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | keep what is there | `https://<test ref>.supabase.co` | Config |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | keep what is there | test project: **Settings** > **API Keys**, the **anon** / publishable key | Config |
| `SUPABASE_SERVICE_ROLE_KEY` | keep what is there | test project: **Settings** > **API Keys**, the **service_role** / secret key | Secret |
| `NEXT_PUBLIC_FIREBASE_*` (six names) | keep what is there | nothing to do if the name already covers **Preview** (same values as Production); see the note under the steps | Config |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | the new key file from section 3 | done in section 3.4 - skip here | Secret |
| `NEXT_PUBLIC_SITE_URL` | the website's public address, for example `https://<your domain>` | skip | Config |

Names starting with `NEXT_PUBLIC_` are sent to every visitor's browser, so they never hold a secret.

The one rule for this section: **never untick Production on a name that already exists, and never change the value
of a name that covers Production.** In most Vercel projects one entry holds a name for all environments at once; if
you took Production away from it, the next live deployment would be built without that setting and the live website
would break. Instead you take only **Preview** away from the existing entry, and then add a second, Preview-only entry
with the test value.

Steps for one name (repeat for the three Supabase rows; skip the rows marked "skip"):

1. In the project, click **Settings**, then **Environment Variables** in the sidebar.
   You should now see an "Add New" form at the top and the list of existing names below it.
2. Look in the list for the name. Next to it, Vercel shows which environments the entry covers (**Production**,
   **Preview**, **Development**). Then:
   - If the name is not in the list at all, go to step 6.
   - If the name is listed for **Preview** only (no **Production**), click the three dots next to it, click **Edit**,
     paste the test value into **Value** as step 8 says, keep only **Preview** ticked, click **Save**, and you are done
     with this name.
   - If the entry covers **Production** (alone, or together with **Preview** or **Development**), continue at step 3.
3. Click the three dots next to that entry and click **Edit**.
4. Under the environments, untick **Preview** only. Keep **Production** ticked, and leave **Development** as it was.
   Do not touch **Value**.
5. Click **Save**.
   You should now see the name still listed for **Production**, but no longer for **Preview**. If **Production** has
   gone from it, stop and tell me at once (0.3).
6. Go to the "Add New" form at the top of the page.
7. Under **Type**, choose **Config** or **Secret** as the table says, and in **Key** (or **Name**) type the name
   exactly as in the table.
8. In **Value**, paste the test value. For the URL, type `https://<test ref>.supabase.co` with the 20 letters from 1.3.
   For the two Supabase keys: open the `seva-test` project in Supabase in another tab, click **Project Settings** >
   **API Keys**, click **Copy** next to the key, and paste here. (UNVERIFIED: Supabase shows the older **anon** and
   **service_role** keys under a "Legacy" heading on that page.)
9. Under the environments, tick **Preview** only and untick **Production** and **Development**.
10. Click **Save**.
    You should now see the name listed twice: once for **Production** with the old value, and once for **Preview**
    with the label **Config** or **Secret**.

Note on the six `NEXT_PUBLIC_FIREBASE_*` names: look at each one in the list. If it already covers **Preview**, there
is nothing to do. If one covers **Production** but not **Preview**, click its three dots > **Edit**, tick **Preview**
as well (keep **Production** and **Development** as they are, do not change **Value**), and click **Save**.

A new value only reaches the site after a new deployment. You do not need to redeploy for the Preview values; the next
test build picks them up. Taking Preview away from an entry does not change the live site.

### Tell me it is done

Send me this message in chat (it holds no secret; fill in the brackets):
`Section 2 done - plan <Hobby or Pro>, function region <region>, preview settings added`.

## 3. Revoke the old Firebase key

When: after I tell you the build is merged into main, not before.

Why: an old Firebase service-account key was once written into the code, so anyone with a copy of the code could use
it (open item O-18). In the build, the scripts read the key from a git-ignored file or a secret instead (task A1-5).
Until the build is merged, the 11 one-off scripts on main still carry the old key inside them, so this section waits
for the merge: after it, nothing needs the old key and it can be switched off. (Nothing runs those scripts on a
schedule, so the website and the nightly jobs do not depend on them either way.)

You make a new key, put it everywhere the old one is used, check the site, and only then delete the old key. Deleting
a key cannot be undone, so the order matters.

What you need: your Google sign-in for the Firebase project, your GitHub and Vercel sign-ins, about 30 minutes.

Vendor pages read for this section:
(source: https://docs.cloud.google.com/iam/docs/keys-create-delete, checked 2026-10-18)
(source: https://docs.cloud.google.com/iam/docs/keys-disable-enable, checked 2026-10-18)
(source: https://firebase.google.com/docs/admin/setup, checked 2026-10-18)
(source: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets, checked 2026-10-18)
(source: https://vercel.com/docs/environment-variables/managing-environment-variables, checked 2026-10-18)
(source: https://vercel.com/docs/deployments/managing-deployments, checked 2026-10-18)

### 3.1 Make the new key

1. Open `https://console.cloud.google.com/iam-admin/serviceaccounts` and sign in with the Google account that owns
   the Firebase project.
2. At the top of the page, click the project picker and choose the project with the same name as your Firebase
   project.
   You should now see a list of service accounts with their emails.
3. Click the email that starts with `firebase-adminsdk-`.
4. Click the **Keys** tab.
   You should now see a list of the existing keys with their creation dates. Write down how many keys there are and
   their creation dates.
5. Click **Add key**, then **Create new key**.
6. Choose **JSON**.
7. Click **Create**.
   You should now see a message that the key was saved, and a `.json` file in your **Downloads** folder. Its name is the
   project name plus 12 letters and numbers. Google cannot download this file again, so do not lose it.
8. Look at the **Keys** list again. The new key's ID starts with the same 12 letters and numbers as the file name.
   Write those 12 characters down so you never delete the new key by mistake. (UNVERIFIED: Google names the file
   this way today.)

(Same result from the Firebase side: Firebase console > gear > **Project settings** > **Service accounts** >
**Generate new private key** > **Generate key**.)

### 3.2 Put the new key in the git-ignored file on this PC

1. Open **File Explorer**, click **View** > **Show** > **File name extensions** so you can see the `.json` endings.
2. Go to `D:\Onboarding\Repos\POCs\General Purpose POCs Git Connected`.
3. If a file named `.firebase-adminsdk.json` is there (it holds the old key), click it once, hold **Shift** and press
   **Delete**.
   You should now see a box asking "Are you sure you want to permanently delete this file?". Click **Yes**. Shift+Delete
   skips the Recycle Bin, so the old key is gone at once and nothing else is touched.
4. Open your **Downloads** folder and drag the new `.json` file into
   `D:\Onboarding\Repos\POCs\General Purpose POCs Git Connected`. Dragging between folders on the same drive moves it;
   if Downloads is on another drive, it copies, so remove the one left in Downloads afterwards with **Shift**+**Delete**
   as in step 3.
5. Right-click the new file, click **Rename**, type `.firebase-adminsdk.json` (with the dot at the start), and press
   **Enter**.
   You should now see `.firebase-adminsdk.json` in the folder. Git ignores this exact name, so it never goes into the
   code.

### 3.3 Replace the key in GitHub secrets

1. Open `https://github.com/nikhilmn01/Rayaramathaynk` and sign in.
2. Click **Settings** (under the repository name).
3. In the left sidebar, under **Security**, click **Secrets and variables**, then **Actions**.
4. Click the **Secrets** tab.
   You should now see a list of secret names. The values are hidden; that is normal.
5. Find `FIREBASE_SERVICE_ACCOUNT_JSON` in the list. If it is there, click the pencil icon next to it (**Update**).
   If it is not there, click **New repository secret** and type `FIREBASE_SERVICE_ACCOUNT_JSON` in **Name**.
   (UNVERIFIED: GitHub's page does not name the pencil button. If you cannot find it, delete the secret with the bin
   icon and add it again with the same name.)
6. Open `.firebase-adminsdk.json` with **Notepad** (right-click > **Open with** > **Notepad**).
7. Press **Ctrl+A**, then **Ctrl+C** to copy all of it.
8. Click in the GitHub **Secret** (or **Value**) box and press **Ctrl+V**.
9. Click **Update secret** (or **Add secret**).
   You should now see the secret's "Updated" time change to "now".
10. If the list also has `FIREBASE_SERVICE_ACCOUNT`, repeat steps 5 to 9 for it with the same whole file.
11. If the list has `FIREBASE_PRIVATE_KEY`, repeat steps 5 to 9 for it, but paste only the text between the quotes
    after `"private_key":` in the Notepad file (it starts and ends with five dashes; keep the `\n` marks as they are).
12. If the list has `FIREBASE_CLIENT_EMAIL`, it stays the same (the email does not change with a new key). Leave it.
13. Close Notepad without saving changes.

### 3.4 Replace the key in Vercel

1. Open the Vercel project > **Settings** > **Environment Variables**.
2. Look for these names: `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_PRIVATE_KEY`, `NEXT_PUBLIC_FIREBASE_PRIVATE_KEY`.
3. If `FIREBASE_SERVICE_ACCOUNT_JSON` is in the list, click the three dots next to it and click **Edit**. If it is not,
   use the "Add New" form at the top, choose **Secret** under **Type**, and type `FIREBASE_SERVICE_ACCOUNT_JSON` in
   **Key**.
4. Open `.firebase-adminsdk.json` in **Notepad**, press **Ctrl+A**, then **Ctrl+C**.
5. Click in **Value** and press **Ctrl+V**.
6. Tick **Production** and **Preview**.
7. Click **Save**.
   You should now see `FIREBASE_SERVICE_ACCOUNT_JSON` labelled **Secret** for Production and Preview. The website reads
   this name first, so it uses the new key from the next deployment.
8. If `FIREBASE_PRIVATE_KEY` is in the list, click its three dots and click **Edit**.
9. Paste only the text between the quotes after `"private_key":` (as in 3.3.11) into **Value** and click **Save**.
10. If `NEXT_PUBLIC_FIREBASE_PRIVATE_KEY` is in the list, click its three dots and click **Delete**.
11. Confirm the delete. A name that starts with `NEXT_PUBLIC_` is sent to every visitor's browser, so a key must never
    be stored under it.
12. Close Notepad without saving changes.
13. Click **Deployments** in the sidebar.
14. On the newest deployment marked **Production**, click the three dots and click **Redeploy**.
15. In the **Redeploy to Production** window, click **Redeploy**.
    You should now see a new deployment that turns to **Ready** after a few minutes.

### 3.5 Check the website works with the new key

1. Open the temple website and sign in to the admin pages as you normally do.
2. Open **Users** (or any admin page that lists data).
   You should now see the usual data with no error message.
3. If you see an error, stop here. Do not delete any key. Tell me the step number and the error text.

### 3.6 Delete the old key

1. Go back to the **Keys** tab of the `firebase-adminsdk-` service account (3.1 steps 1 to 4).
2. Find each key whose ID does **not** start with the 12 characters you wrote down in 3.1.8 and whose creation date is
   before today.
3. If you know of another computer or service that uses one of those old keys, stop and tell me first.
4. Click the bin icon (**Delete**) next to one old key.
   You should now see a box asking you to confirm.
5. Click **Delete** in that box. A deleted key cannot be brought back.
6. Repeat steps 4 and 5 for each remaining old key.
   You should now see only the new key in the list.
7. Repeat 3.5 once more to check the website still works.

### Tell me it is done

Send me this message in chat (it holds no secret; fill in the brackets):
`Section 3 done - new key in file, GitHub and Vercel; <number> old keys deleted; site works`.

## 4. Backup secrets and the age key

Why: every night a GitHub job copies the whole database, locks it with a public "lock" key, and keeps the locked file
for 30 days (open item O-15). Only the matching private "unlock" key can open it. That unlock key lives on two USB
drives in the office, never on any computer or website. If both USB drives are lost, the backups cannot be opened.

What you need: two USB drives (any size), a label pen, your Supabase and GitHub sign-ins, about 30 minutes.

Vendor pages read for this section:
(source: https://github.com/FiloSottile/age, checked 2026-10-18)
(source: https://supabase.com/docs/guides/database/connecting-to-postgres, checked 2026-10-18)
(source: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets, checked 2026-10-18)
(source: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow, checked 2026-10-18)

### 4.1 Install age on this PC

1. Click **Start**, type `Terminal`, and click **Terminal**.
2. Type `winget install --id FiloSottile.age` and press **Enter**.
   You should now see a download and "Successfully installed". If it asks to accept terms, type `Y` and press
   **Enter**.
3. Close the Terminal window and open a new one (so it finds the new program).
4. Type `age --version` and press **Enter**.
   You should now see a version number such as `v1.2.1`.

### 4.2 Make the key pair straight onto the first USB drive

The key file is made directly on the USB drive, so it never sits on the PC's own disk.

1. Plug in the first USB drive.
2. Open **File Explorer** and note its drive letter (for example **USB Drive (E:)**).
3. In the Terminal window, type `cd E:\` (use your drive letter) and press **Enter**.
4. Type `age-keygen -o seva-backup-key.txt` and press **Enter**.
   You should now see one line that starts with `Public key: age1` followed by many letters and numbers.
5. Select that `age1...` text with the mouse (from `age1` to the end of the line) and press **Ctrl+C** to copy it.
   This is the public lock key. It is safe to put into GitHub; it cannot open anything.
6. Keep the Terminal window open; you paste the public key in 4.3.

Never open `seva-backup-key.txt` in an editor that syncs to the internet, never email it, and never paste its
contents anywhere. The file holds the private unlock key.

### 4.3 Put the public key into GitHub

1. Open `https://github.com/nikhilmn01/Rayaramathaynk` > **Settings** > **Secrets and variables** > **Actions** >
   **Secrets** tab (as in 3.3 steps 1 to 4).
2. Click **New repository secret**.
3. In **Name**, type `SEVA_BACKUP_AGE_RECIPIENT`.
4. Click in **Secret** and press **Ctrl+V** to paste the `age1...` public key.
5. Click **Add secret**.
   You should now see `SEVA_BACKUP_AGE_RECIPIENT` in the list.

### 4.4 Put the database connection string into GitHub

The nightly job needs to read the **live** database. Supabase calls the address it needs the **Session pooler**
string (port 5432). GitHub's computers need this kind, because it works over the older internet addresses (IPv4).

1. Open `https://supabase.com/dashboard` and click the **live** temple project.
2. Click **Connect** at the top of the page.
   You should now see a window with several connection strings.
3. Choose **Session pooler**. (UNVERIFIED: it may sit under a **Method** or **Type** drop-down.)
   You should now see a string that looks like
   `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-<n>-<region>.pooler.supabase.com:5432/postgres`.
4. Click **Copy**.
5. Open **Notepad** and press **Ctrl+V**.
6. Replace `[YOUR-PASSWORD]` (including the square brackets) with the live database password.
   If the password has any of these signs `@ : / ? # & %` or a space, stop and tell me "Section 4 needs password
   help" - those signs need special writing and I will tell you how.
   If you do not know the live database password, stop and tell me "Section 4 blocked - no DB password". Do not reset
   it yourself: other things use it, and resetting it would break them.
7. Press **Ctrl+A**, then **Ctrl+C**.
8. In GitHub (same Secrets page), click **New repository secret**.
9. In **Name**, type `SEVA_BACKUP_DB_URL`.
10. Click in **Secret** and press **Ctrl+V**.
11. Click **Add secret**.
    You should now see `SEVA_BACKUP_DB_URL` in the list.
12. Close Notepad and click **Don't save**. The string must not stay in a file on the PC.

### 4.5 Copy the key file to the second USB drive

1. Plug in the second USB drive.
2. In **File Explorer**, open the first USB drive, right-click `seva-backup-key.txt`, and click **Copy**.
3. Open the second USB drive, right-click an empty space, and click **Paste**.
   You should now see `seva-backup-key.txt` on both drives.
4. Label both drives "Seva backup key - do not format".
5. Click the **Safely Remove Hardware** icon (bottom right of the taskbar) and eject both drives.
6. Keep the two drives in two different places (for example the office safe and the trustee's home), never with the
   counter PC.

### 4.6 First backup run (after I tell you the backup job is on main)

The nightly job runs by itself at 02:30 India time once the build's backup file is part of the main branch. I will
tell you when that is. Then:

1. Open the repository on GitHub and click **Actions**.
2. In the left sidebar, click the backup workflow (its name contains "backup").
3. Click **Run workflow**, keep **Branch** as `main`, and click the green **Run workflow** button.
   You should now see a new run with a yellow dot that turns into a green tick after a few minutes.
4. If it turns into a red cross, tell me the run's date and time (not its log).

### Tell me it is done

Send me this message in chat (it holds no secret): `Section 4 done - both secrets added, key on two USB drives`.

## 5. Restore drill (once a month)

Why: a backup is only useful if it can be opened. Once a month (and once before go-live) you check that the latest
backup opens with the key on the USB drive. This takes about 20 minutes and changes nothing anywhere.

What you need: one of the two USB drives, this PC, your GitHub sign-in.

Vendor pages read for this section:
(source: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts, checked 2026-10-18)
(source: https://github.com/actions/upload-artifact, checked 2026-10-18)
(source: https://www.postgresql.org/download/windows/, checked 2026-10-18)
(source: https://enterprisedb.com/docs/supported-open-source/postgresql/installing/windows, checked 2026-10-18)

### 5.1 One-time: install the PostgreSQL command line tools

1. Open `https://www.enterprisedb.com/downloads/postgres-postgresql-downloads`.
2. In the **Windows x86-64** column, click the download for the highest version listed.
3. Run the downloaded installer and click **Next** on the first screens.
4. On **Select Components**, untick **PostgreSQL Server**, **pgAdmin 4** and **Stack Builder**, and keep
   **Command Line Tools** ticked. (UNVERIFIED: if the installer will not continue without the server, keep
   **PostgreSQL Server** ticked too; it does no harm.)
5. Click **Next** until **Finish**. Untick the offer to launch Stack Builder.
   You should now see a folder `C:\Program Files\PostgreSQL\<version>\bin`. Write down the version number.

### 5.2 Download the latest backup

1. Open the repository on GitHub and click **Actions**.
2. In the left sidebar, click the backup workflow.
3. Click the newest run with a green tick.
   You should now see the run's summary page with an **Artifacts** section near the bottom.
4. In **Artifacts**, click the one named `seva-<date>` (the newest date).
   You should now see a `.zip` file in your **Downloads** folder.
5. Make a new folder `C:\SevaDrill`.
6. Right-click the `.zip` file, click **Extract All**, choose `C:\SevaDrill`, and click **Extract**.
   You should now see two files in `C:\SevaDrill`: one ending in `.dump.age` and one ending in `.sha256`.

### 5.3 Open it with the key

The drill script lives in the build's folder, `D:\Onboarding\Repos\POCs\seva-entry`. The repository folder
`D:\Onboarding\Repos\POCs\General Purpose POCs Git Connected` does not have it until that folder is brought up to the
latest main, so do not use that one unless I tell you to.

1. Plug in one of the two USB drives and note its letter (for example `E:`).
2. In **File Explorer**, open `D:\Onboarding\Repos\POCs\seva-entry`.
3. Open the folder `scripts`, then `seva`.
   You should now see a file `verify-backup.sh` (with **File name extensions** on, as in 3.2.1). If the folder
   `seva-entry`, the folder `seva` or the file is missing, stop and tell me "Section 5 - no drill script"; I will tell
   you which folder to use instead.
4. Go back up twice to `D:\Onboarding\Repos\POCs\seva-entry`, right-click an empty space, click **Show more options**,
   then **Open Git Bash here**.
   You should now see a window with a `$` sign at the end of the last line.
5. Type `export PATH="$PATH:/c/Program Files/PostgreSQL/<version>/bin"` with your version number from 5.1.5, and
   press **Enter**.
6. Type `bash scripts/seva/verify-backup.sh /c/SevaDrill/<file name>.dump.age /e/seva-backup-key.txt` (use your file
   name and your USB letter in small letters) and press **Enter**.
   You should now see these lines, with your own numbers:
   `Checksum: matches the .sha256 file`, `Decryption: ok (whole file)`, then `Archive entries: <n>`, `Schemas: <n>`,
   `Tables: <n>` (a number above 0), and lines for table data, sequences, functions, indexes, triggers and
   row-level security policies. It prints no names or phone numbers.
   If the first line says `Checksum: not checked (no .sha256 file next to the backup)`, the `.sha256` file is not in
   `C:\SevaDrill` next to the backup; the drill still counts, but tell me.
   If a line starts with `verify-backup:` instead, the drill failed. Copy that one line (it holds no secret) and send
   it to me with the step number.
7. Close the Git Bash window.
8. Eject the USB drive (**Safely Remove Hardware**) and put it back in its place.
9. Delete the folder `C:\SevaDrill` and the `.zip` in **Downloads**: click each one, hold **Shift** and press
   **Delete**, then click **Yes**. This skips the Recycle Bin, so nothing else of yours is deleted.

### Tell me it is done

Send me this message in chat (it holds no secret; fill in the brackets):
`Section 5 done - backup of <date> opened, counts shown`.

## 6. Local database tests need no set-up

Nothing to install and no account to make. The build's database tests run a small copy of Postgres inside Node.js on
this PC (PGlite), so there is no Docker, no extra program, and no connection to the live or the test database. I run
them myself (`npm run test:db`) and tell you the result.

### Tell me it is done

Send me this message in chat (it holds no secret): `Section 6 done - read`.

## 7. The counter PC

Do this section when I tell you the counter page is ready for the print test. Some steps (7.6 to 7.8) need the
counter page itself.

Why: the counter PC holds devotees' names and the day's receipts, prints the 99 x 210 mm slips without a print dialog,
and keeps an Excel copy of each day (open items O-05, O-07, O-08, O-09).

What you need: the counter PC, its printer and driver CD or download, a temple admin sign-in, about 60 minutes.

Vendor pages read for this section:
(source: https://support.microsoft.com/en-us/accounts-billing/security/sign-in-options-in-windows, checked 2026-10-18)
(source: https://support.microsoft.com/en-us/windows/device-encryption-in-windows-cf7e2b6f-3e70-4882-9532-18633605b7df, checked 2026-10-18)
(source: https://support.microsoft.com/en-us/windows/hardware/printer/set-a-default-printer-in-windows, checked 2026-10-18)
(source: https://epson.com/faq/SPT_C11C524001~faq-140652, checked 2026-10-18; dated 2009, possibly stale)
(source: https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/ux, checked 2026-10-18)
(source: https://learn.microsoft.com/en-us/deployedge/microsoft-edge-browser-policies/silentprintingenabled, checked 2026-10-18)
(source: https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api, checked 2026-10-18; dated 2024-01-09, possibly stale)

### 7.1 A Windows password for the counter account

1. Click **Start** > **Settings** > **Accounts** > **Sign-in options**.
2. Click **Password**.
   You should now see a button **Add** (no password yet) or **Change** (a password is already set). If it says
   **Change**, skip to 7.2.
3. Click **Add**.
4. Type a new password in both password boxes.
5. Type a hint that does not give the password away.
6. Click **Next**, then **Finish**.
   You should now see that Windows asks for this password the next time the PC starts.
7. Write the password on paper kept in the office safe, not on the counter.

### 7.2 Encrypt the disk (BitLocker or Device encryption)

1. Click **Start** > **Settings** > **Privacy & security**.
2. Click **Device encryption**. (On Windows Pro you may instead see **BitLocker drive encryption** under
   **Settings** > **System** > **Storage** > **Advanced storage settings**, or in **Control Panel**; UNVERIFIED path.)
   If neither appears, this PC cannot encrypt; tell me in the final message ("no encryption").
3. Switch **Device encryption** to **On**.
   You should now see "Encrypting..." and later "On".
4. When Windows offers to save the **recovery key**, save it to a USB drive or print it, and keep it in the office
   safe, separate from the backup-key drives. Without it, a broken PC's disk cannot be read.

### 7.3 Install the printer and make the slip paper size

1. Install the printer with its driver from the maker's website or CD, as its manual says.
2. Click **Start** > **Settings** > **Bluetooth & devices** > **Printers & scanners**.
3. Scroll down to **Related settings** and click **Print server properties**.
   You should now see a small window with a **Forms** tab.
4. On the **Forms** tab, tick **Create a new form**.
5. In **Form name**, type `Seva slip 99x210`.
6. Under **Units**, choose **Metric**.
7. Set **Width** to `9.90cm` and **Height** to `21.00cm`. Set all four printer area margins to `0.00cm`.
8. Click **Save Form**, then **Close**.
   You should now see `Seva slip 99x210` in the forms list the next time you open this window.
9. Back in **Printers & scanners**, click the printer, then **Printing preferences**.
10. Set the paper size to **Seva slip 99x210** and the paper source (tray) to the **Bypass tray** (some printers call it
    **Manual feed** or **Multi-purpose tray**). Set orientation to **Portrait**.
11. Click **OK**.
    (UNVERIFIED on the temple printer: some printer drivers do not show forms made here; if the size is missing in
    step 10, tell me the printer model.)

### 7.4 Make it the default printer

1. In **Printers & scanners**, under **Printer preferences**, switch **Let Windows manage my default printer** to
   **Off**.
2. Click the printer, then click **Set as default**.
   You should now see "Default" under the printer's name.

### 7.5 Stop Edge running in the background

The silent printing switch only works when Edge starts fresh, so Edge must not keep running in the background.
(UNVERIFIED: the setting names below come from guides other than Microsoft's.)

1. Open **Microsoft Edge**.
2. Type `edge://settings/system` in the address bar and press **Enter**.
3. Switch **Startup boost** to **Off**.
4. Switch **Continue running background extensions and apps when Microsoft Edge is closed** to **Off**.
5. Close every Edge window.

### 7.6 Install the counter as an app

1. Open Edge and go to the counter address I give you (it ends with `/admin/receipts/counter`).
2. Sign in with your temple admin account.
3. In the address bar, click the **App available** icon, then click **Install**.
   You should now see the counter open in its own window, and a small window after installing.
4. In that small window, tick **Pin to taskbar** and leave **Auto-start on device login** unticked (the shortcut in
   7.7 starts the counter instead).
5. Close the app window and every Edge window.

### 7.7 The kiosk-printing shortcut

1. Right-click an empty space on the desktop, then click **New** > **Shortcut**.
   You should now see a box "Type the location of the item".
2. Type, all on one line, with your site address in place of `<site>`:
   `"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk-printing --app=https://<site>/admin/receipts/counter`
3. Click **Next**.
4. In "Type a name for this shortcut", type `Seva counter`.
5. Click **Finish**.
   You should now see a **Seva counter** icon on the desktop.
6. Make sure every Edge window is closed, then double-click **Seva counter**.
   You should now see the counter page in its own window without an address bar.
7. On the counter, issue one test receipt as I describe at the print test.
   You should now see the slip come out of the bypass tray with no print window on screen.
8. If a print window appears instead, tell me. The fallback is an Edge setting called "Enable Silent Printing"
   (Edge version 144 or later), which I will walk you through. (UNVERIFIED on the temple PC.)

### 7.8 Register the PC and choose the Excel folder

1. In **File Explorer**, make a folder `D:\Seva receipts` (or `C:\Seva receipts` if the PC has no D: drive).
2. Open the counter (**Seva counter** shortcut) and sign in as a temple admin.
3. Go to **Settings** > **Receipts** > **Counters** and click **Register this PC** for **Counter 1**.
   (UNVERIFIED: the exact screen is built later in this project; I will confirm the wording at the print test.)
   You should now see Counter 1 marked as registered to this PC.
4. On the counter, click **Choose folder**.
   You should now see the Windows folder picker.
5. Pick the `Seva receipts` folder and click **Select Folder**.
6. When the browser asks whether the site may view and edit files in that folder, click **Edit files** (or **Allow**).
   If it offers **Allow on every visit**, choose that.
7. Restart the PC, sign in to Windows, and open **Seva counter** again.
8. Note whether the counter asks again for the folder ("Allow saving to D:\Seva receipts"). Either way is fine; I need
   to know which (open item O-08).

### Tell me it is done

Send me this message in chat (it holds no secret; fill in the brackets):
`Section 7 done - password set, encryption <on or none>, slip printed without a dialog <yes or no>, folder asked again after restart <yes or no>`.

## 8. Cashfree test account (Phase 2)

Written in Plan B.

## 9. Expo account (Android app)

Written in Plan C.
