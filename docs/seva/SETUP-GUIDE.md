# Seva Entry - setup guide

For the Seva Entry build of the Sri Raghavendra Swamy Matha website. Rewritten 2026-10-19 (Monday) around who really
owns what: you develop on your own fork, and the person who runs the live website owns every live account.

This guide is written for someone who has never used Supabase, Firebase, Vercel, GitHub secrets or `age` before.
Follow it one step at a time. You do not need to understand why a step is there; where it matters, the reason is
given in one line.

## 0. Start here

### 0.1 Two people, two sets of accounts

There are two people in this guide. **You** are Nikhil (GitHub `nikhilmn01`): you own the fork
`https://github.com/nikhilmn01/Rayaramathaynk` and build on this PC. **The site owner** (GitHub `ngowda759`) runs the
live website: he owns `https://github.com/ngowda759/Rayaramathaynk` and every live account behind it - the live Vercel
project, the live Firebase project, any live Supabase project and his repository's GitHub secrets. You have none of
those and you do not need them. Your work reaches his repository only through a pull request that he merges.

So this guide has two parts. **Part A** is your own test setup: free accounts you create yourself, starting from the
sign-up screen, because your new accounts are empty. **Part B** is for the site owner, after he merges the pull
request; you forward it to him as it is. Nothing in Part A touches the live website.

### 0.2 Do this next

Only one thing: **A1. Your Supabase test project** (about 30 minutes). When it is done, tell me with the message at
the end of A1. I will tell you the next step after that.

### 0.3 Every section: who, when, why

| Section | Who | When | Why |
|---|---|---|---|
| A1. Your Supabase test project | You | **Now** - the one thing to do next | The build's tables need a real database you control, separate from the live one |
| A2. Your Firebase test project | You | After A1, before the end of wave A4 | Signing in to a test copy of the site needs a Firebase project you control |
| A3. Seeing the test site: this PC or your phone | You | At the end of wave A4 (the 10-minute check). The Vercel part only if you want to check on a phone, and for Plan B | You look at the finished screens yourself |
| A4. Cashfree test account and Expo account | You | Cashfree in Plan B, Expo in Plan C | Test payments and the Android app need accounts you own |
| A5. The counter PC | You, at the temple | At go-live, when I tell you the counter page is ready for the print test | Printing slips without a dialog, the Excel copy, a locked-down PC |
| B1. Supabase: add the new tables | Site owner | Right after he merges the pull request | The live database gets the seva tables |
| B2. Firebase: publish the new rules | Site owner | Right after he merges | The build changed who may create user records |
| B3. Replace and revoke the old Firebase key | Site owner | After he merges, not before | An old key was written into the code; it must be switched off |
| B4. Vercel settings for the live website | Site owner | After he merges | Check names, region and plan on the live project |
| B5. Make yourself staff 001 | Site owner | After B1 to B4 | The first super admin of the seva module |
| B6. The backup key | Site owner (and you, if he chooses two keys) | Before the first nightly backup | Only this key can open the backups |
| B7. GitHub secrets on his repository | Site owner | After B6 | The nightly backup and the scripts read these |
| B8. Restore drill | Whoever holds a backup key | Once a month, first time before go-live | Proves a backup can be opened |
| B9. Cashfree live | Site owner | Later, after Plan B is merged | Real payments on the live site |
| Local automated tests | Nobody | - | Nothing to do: they run inside Node.js on this PC with no account (I run them) |

### 0.4 Old section numbers

Some plans and messages still name the old section numbers. This is where each one went:

| Old | Now |
|---|---|
| 1 | A1 (the look at the live project's size and region moved to B1) |
| 2 | A3 for your own Vercel; B4 for the live Vercel project |
| 3 | B3 |
| 4 | B6 and B7 |
| 5 | B8 |
| 6 | "Local automated tests" in 0.3 - nothing to do |
| 7 | A5 |
| 8 | A4.1 |
| 9 | A4.2 |
| 10 | B9 |

### 0.5 What the marks mean

- **Bold words** are what you will see on the screen: a button, a menu, a tab or a field name.
- One numbered step = one action. Do it, then read the next step.
- A line that starts with "What you should see now:" tells you what the screen looks like after the step. If your
  screen looks different, stop and tell me what you see (0.7).
- `Text in this font` is something you type or copy exactly as it is, letter for letter.
- `<something in angle brackets>` is a placeholder: type your own value there, without the angle brackets.
- UNVERIFIED means I could not confirm that exact screen or wording on the vendor's own pages. The step is still right
  in spirit; the button name may differ slightly. Where I was not sure of a label, the step describes the button
  instead of naming it.
- Each account section names the vendor pages I read, as `(source: <web address>, checked <date>)`. Vendors change
  their screens often; if a screen looks very different, the vendor has probably changed it since that date.

### 0.6 Secrets: the one rule that matters

A **secret** is anything that lets someone into a system: a password, a database connection string, a "service role"
or "secret" key, an access token, a Firebase key file (`.json`), and a backup key file (`seva-backup-key.txt`).

- **Never paste a secret into chat** - not to me, not to anyone. I never need to see one.
- **Never paste a secret into git**, a document, an email, WhatsApp, or a screenshot.
- Each secret goes to exactly one kind of place, and each section says which:
  1. **Your test values** go into two git-ignored files on this PC, in the folder `D:\Onboarding\Repos\POCs\seva-entry`:
     `.env.local` (made in 0.8) and `.firebase-adminsdk.json` (A2). Git ignores both names there (checked on
     2026-10-19 with `git check-ignore`), so they never go into the code. If you use Vercel (A3), the same test values
     also go into your own Vercel project.
  2. **Your passwords** (Supabase database password, sign-in passwords) go into a password manager, or on paper kept
     at home or in the office.
  3. **Live values** belong to the site owner only: his Vercel project, his GitHub secrets, his own computer (Part B).
  4. **The backup key** goes onto a USB drive kept in a safe place, or into a password manager (B6).
- Things that are **not** secret and that you may send me: a project ref (20 letters), a Firebase project ID, a region
  name, a plan name, a key's creation date, and the "Section ... done" messages at the end of each section.
- Take a screenshot for me only if no password, key or connection string is visible on it.

### 0.7 If something looks different or goes wrong

1. Stop. Do not click around to "fix" it.
2. Write down the step you were on (for example "A1.3 step 4").
3. Copy any error text that has no password or key in it.
4. Tell me the step and what you see. I will tell you what to do next.

### 0.8 How to make your `.env.local` file with Notepad

`.env.local` is a small text file that holds your **test** settings, one `NAME=value` per line. The website reads it
when it runs on this PC, and so do the build's scripts. You make it once (in A1) and add lines to it later (in A2).

1. Click **Start**, type `Notepad`, and click **Notepad**.
2. Type (or copy from this guide) the lines the section gives you, one per line.
3. Click **File** > **Save as**.
4. In the left of the save window, go to `D:\Onboarding\Repos\POCs\seva-entry` (type it into the address bar at the
   top of the window and press **Enter**).
5. Next to **Save as type**, choose **All files (\*.\*)**. This stops Notepad adding `.txt` to the name.
6. In **File name**, type `.env.local` (with the dot at the start).
7. Click **Save**.
   What you should see now: Notepad's title bar shows `.env.local`.
8. To check the name: open **File Explorer**, click **View** > **Show** > **File name extensions**, and open
   `D:\Onboarding\Repos\POCs\seva-entry`.
   What you should see now: a file named exactly `.env.local`. If it is `.env.local.txt`, right-click it, click
   **Rename**, remove `.txt`, press **Enter**, and click **Yes** when Windows asks.

To add lines later: right-click `.env.local` > **Open with** > **Notepad**, add the lines at the end, press **Ctrl+S**,
and close Notepad. Never send me this file or its contents.

### 0.9 How to open a PowerShell window in a folder

1. Open **File Explorer** (the yellow folder icon on the taskbar).
2. Go to the folder the section names (for example `D:\Onboarding\Repos\POCs\seva-entry`).
3. Right-click an empty space inside the folder.
4. Click **Open in Terminal**.
   What you should see now: a dark window whose last line ends with the folder name and a `>` sign. Type commands
   there and press **Enter** after each one.

When a command asks for a password, the letters you type do not appear on screen. That is normal. Type it and press
**Enter**.

## Part A - Your own test setup (you do these)

Everything in Part A is free and happens in accounts you create yourself. None of it can touch the live website.
Start each account from its sign-up page; nothing exists yet in any of them.

## A1. Your Supabase test project

Why: the build must be tried on a real database that you control. Supabase is that database. Your new account is
empty, so you create the organisation, the project and the tables yourself. The Free plan is enough.
(source: https://supabase.com/pricing, checked 2026-10-18)

What you need: an email address (or your GitHub sign-in), this PC, about 30 minutes.

Vendor pages read for this section:
(source: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs, checked 2026-10-19)
(source: https://supabase.com/docs/guides/platform/regions, checked 2026-10-18)
(source: https://supabase.com/docs/reference/cli/supabase-login, checked 2026-10-18)
(source: https://supabase.com/docs/reference/cli/supabase-db-push, checked 2026-10-18)
(source: https://supabase.com/docs/guides/local-development/cli/getting-started, checked 2026-10-18)

### A1.1 Sign up

1. Open `https://supabase.com/dashboard/sign-up` in the browser.
   What you should see now: a sign-up page with a **Continue with GitHub** button and boxes for an email and a
   password. (UNVERIFIED: the exact wording of the buttons.)
2. Click **Continue with GitHub** and sign in to GitHub as `nikhilmn01`, then allow Supabase when GitHub asks.
   Or type your email and a new password and click the sign-up button; then open the email Supabase sends you and
   click the confirmation link in it.
   What you should see now: the Supabase dashboard, asking you to create an organisation, or an empty page with a
   button to create one. If you see something else, stop and tell me what you see.

### A1.2 Create your organisation

An organisation is just a folder for your projects. You need one before you can make a project.

On 2026-10-19 an organisation already existed when the dashboard first opened: Supabase had created one automatically
at sign-up, and the create-project form opened directly. If that happens to you, skip to A1.3; the Free plan applies.

1. If the dashboard does not already show a "create organisation" form, click the button that says **New
   organization** or similar.
   What you should see now: a form with boxes such as **Name**, **Type** and **Plan**. (UNVERIFIED labels.)
2. In **Name**, type `nikhil-test`.
3. Under **Type**, choose **Personal** (or the nearest choice).
4. Under **Plan**, choose **Free**. Do not enter any card details; the Free plan needs none.
5. Click the button at the bottom that creates the organisation (for example **Create organization**).
   What you should see now: your new organisation with no projects in it, and a button to create a project.

### A1.3 Create the test project

1. Click the button that creates a project (it says **New project** or similar).
   What you should see now: a form with **Project name**, **Database Password** and **Region**.
2. In **Project name**, type `seva-test`.
3. Next to **Database Password**, click the link that generates a password (for example **Generate a password**).
4. Click **Copy** next to the password and save it in your password manager, or write it on paper that stays at home.
   This is a secret: never paste it into chat. You type it once more in A1.5.
5. Under **Region**, choose **South Asia (Mumbai)**. Supabase's code for it is `ap-south-1`. A project's region
   cannot be changed later, so check this twice.
   On 2026-10-19 the **Region** dropdown showed **Asia-Pacific (recommended)** first; **South Asia (Mumbai)** was in
   the list of specific regions below it. Pick Mumbai there. If you cannot find Mumbai anywhere, stop and tell me what
   the list shows.
6. The form also had a **Security** section with three switches: **Data API** on, automatic exposing of new tables on,
   and automatic row level security off. Leave all three as they are: the seva tables switch on their own row level
   security and lock themselves away from the browser in their table files.
7. Leave every other option as it is.
8. Click the button that creates the project (for example **Create new project**).
   What you should see now: a "setting up" screen, then the project's home page with a menu of icons down the left
   and the project shown as **Healthy**. On 2026-10-19 this took about 10 seconds; it can take 2 to 3 minutes.
   (The Postgres version is not shown on the **Infrastructure** page; you do not need it.)

Supabase pauses a Free project that nobody uses for a week. If you later open the dashboard and the project says it is
paused, click the button on that page that resumes or restores it, and wait a few minutes.

### A1.4 Find the project ref

The **project ref** is the 20-letter name of a project. It is not a secret.

1. Look at the browser's address bar while the `seva-test` project is open.
   What you should see now: an address like `https://supabase.com/dashboard/project/abcdefghijklmnopqrst`.
2. Copy the 20 letters after `/project/`. That is the project ref. Write it down; you send it to me at the end.

### A1.5 Put the build's tables into the test project

You run a few commands on this PC. They talk only to your `seva-test` project. They apply every table file of the
site (the older ones and the new seva ones), because your project starts empty.

1. Open a PowerShell window in the folder `D:\Onboarding\Repos\POCs\seva-entry` (see 0.9).
2. Type `node -v` and press **Enter**.
   What you should see now: a version such as `v24.14.0`. The Supabase tools need version 20 or later. If you see a
   lower number or an error, stop and tell me.
3. Type `npx supabase login` and press **Enter**.
   What you should see now: either a question "Need to install the following packages ... Ok to proceed?" (type `y`
   and press **Enter**) or a message about opening the browser.
4. If it asks to open the browser, press **Enter**.
   What you should see now: a Supabase page in the browser asking you to allow the command-line tool.
5. Click the button on that page that allows it (for example **Authorize**).
   What you should see now: in PowerShell, a line saying you are logged in.
   (UNVERIFIED: the browser may instead show a short verification code that PowerShell asks you to type. Type it
   there. If PowerShell asks for an "access token" instead: open `https://supabase.com/dashboard/account/tokens`,
   click the button that generates a new token, name it `seva-pc`, copy it, click in the PowerShell window, press
   **Ctrl+V**, and press **Enter**. The token is a secret: never paste it into chat.)
6. Type `npx supabase link --project-ref <your project ref>` with the 20 letters from A1.4, and press **Enter**.
   What you should see now: a question asking for your database password.
7. Type the database password from A1.3 step 4 (the letters stay invisible) and press **Enter**.
   What you should see now: "Finished supabase link".
8. Type `npx supabase db push --dry-run` and press **Enter**.
   What you should see now: a list of file names that would be applied, the last ones containing `seva`. Nothing has
   been changed yet.
9. Type `npx supabase db push` and press **Enter**.
   What you should see now: the same list and a question "Do you want to push these migrations to the remote
   database?".
10. Type `Y` and press **Enter**.
    What you should see now: each file being applied, then "Finished supabase db push".
11. Close the PowerShell window.

If any step shows red error text, copy the last 20 lines (they do not contain your password) and send them to me with
the step. Do not run the command again until I answer.

### A1.6 Put the test project's three values into `.env.local`

1. In the Supabase dashboard, with `seva-test` open, click **Project Settings** (the gear icon at the bottom of the
   left menu), then **API Keys**.
   What you should see now: a page of keys. (UNVERIFIED: Supabase shows newer "publishable" and "secret" keys, and may
   show the older **anon** and **service_role** keys on a tab called **Legacy** or similar.)
2. Make your `.env.local` file as 0.8 shows, with these three lines:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<your project ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon key, or the publishable key>
   SUPABASE_SERVICE_ROLE_KEY=<the service_role key, or the secret key>
   ```

3. For each key, click **Copy** next to it in Supabase, then click after the `=` sign in Notepad and press **Ctrl+V**.
   If the page has the **Legacy** tab with **anon** and **service_role**, use those two. If it does not, use the
   **publishable** key and the **secret** key (you may need to click a button that reveals the secret key first).
4. Press **Ctrl+S** and close Notepad.
   What you should see now: `.env.local` in `D:\Onboarding\Repos\POCs\seva-entry`, three lines long. The first line
   is not secret; the third line is. Never send me this file.

### A1.7 After each new migration (your step)

The build adds a new table file (a migration) now and then, for example the paper size on 2026-10-19. I never push
to your test project myself. When I tell you a new migration is ready, you push it:

1. Open a PowerShell window in `D:\Onboarding\Repos\POCs\seva-entry` (0.9).
2. Type `npx supabase db push` and press **Enter**.
   What you should see now: only the new file names in the list, and the question "Do you want to push these
   migrations to the remote database?". If it asks for your database password, type it (A1.3 step 4).
3. Type `Y` and press **Enter**.
   What you should see now: "Finished supabase db push". Tell me "db push done".

The project stays linked from A1.5, so `npx supabase login` and `link` are not needed again. Files already pushed are
never changed; every change comes as a new file, so pushing twice does no harm.

### Tell me it is done

Send me this message in chat (it holds no secret; fill in the brackets):
`Section A1 done - test ref <20 letters>, region <region>, tables pushed, .env.local has the three Supabase lines`.

## A2. Your Firebase test project

Why: the website signs people in with Firebase. A test copy of the site needs a Firebase project that you control,
with its own sign-in and its own small database for user records. The free **Spark** plan is enough. (The build's
automated tests use Firebase emulators on this PC and need nothing from you.)

What you need: a Google account (any Gmail address), this PC, about 30 minutes.

Vendor pages read for this section:
(source: https://firebase.google.com/docs/web/setup, checked 2026-10-19)
(source: https://firebase.google.com/docs/auth/web/password-auth, checked 2026-10-19)
(source: https://firebase.google.com/docs/firestore/quickstart, checked 2026-10-19)
(source: https://firebase.google.com/docs/admin/setup, checked 2026-10-18)

### A2.1 Sign in and create the project

1. Open `https://console.firebase.google.com` and sign in with your Google account. If you have no Google account,
   click **Create account** on the Google sign-in page and follow it first.
   What you should see now: the Firebase welcome page with a large button to create a project or get started.
   (Firebase's own page only says "click the button to create a new Firebase project"; it does not name it.) On
   2026-10-19 other projects of the same Google account were also listed there; leave them alone.
2. Click that button.
   What you should see now: a box asking for a project name.
3. Type `seva-test-nikhil`. Below the name, Firebase shows the **project ID** it will use (for example
   `seva-test-nikhil` or that name with a few letters added). Write the project ID down; it cannot be changed later.
4. Accept the Firebase terms if asked. If a **Join the Google Developer Program** switch is shown (it was on by
   default on 2026-10-19), switch it **off**. Click **Continue**.
5. If it offers AI help in the console (a **Gemini** switch, on by default), switch it **off**; this build does not use
   it. Click **Continue**.
6. When it offers **Google Analytics**, switch it **off**. Click the button that creates the project.
   What you should see now: a short wait, then "Your new project is ready" or similar. Click **Continue**.
   What you should see now: the project's home page (**Project Overview**) with a menu down the left, and the plan
   shown as **Spark** (free). If it asks for a card or a paid plan, stop and tell me what you see.

### A2.2 Add a web app and copy its six settings

1. On **Project Overview**, click **Add app** first, then the web icon (it looks like `</>`). (On 2026-10-19 the icon
   appeared only after **Add app**.)
   What you should see now: a form with **App nickname**.
2. In **App nickname**, type `seva-test-web`. Leave **Firebase Hosting** unticked.
3. Click **Register app**.
   What you should see now: a block of code with `const firebaseConfig = {` and lines such as `apiKey`, `authDomain`,
   `projectId`, `storageBucket`, `messagingSenderId` and `appId`.
4. Open your `.env.local` in Notepad (0.8) and add these six lines at the end, each value copied from the line of the
   same name in that block (copy only what is between the quotes):

   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=<apiKey>
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<authDomain>
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=<projectId>
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<storageBucket>
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<messagingSenderId>
   NEXT_PUBLIC_FIREBASE_APP_ID=<appId>
   ```

   These six are not secret (every visitor's browser receives them), but keep them in this file all the same.
5. Press **Ctrl+S**. Back in Firebase, click **Continue to console**.

You can find the same block again any time: gear icon next to **Project Overview** > **Project settings** >
**General** > **Your apps** > **Config**.

### A2.3 Turn on sign-in

1. In the left menu, open **Build** (or **Security**; Firebase moves it now and then) and click **Authentication**.
2. Click **Get started**.
   What you should see now: the **Sign-in method** tab with a list of providers.
3. Click **Email/Password**, switch on the first **Enable** switch (leave "Email link" off), and click **Save**.
   What you should see now: **Email/Password** listed as **Enabled**.
4. For Plan B later (do it now; it costs nothing): click **Add new provider**, click **Google**, switch on **Enable**,
   choose your email under **Project support email** (on 2026-10-19 the dropdown showed "Not configured" and one
   address: pick the address), and click **Save**.
   What you should see now: **Google** listed as **Enabled** as well.

### A2.4 Create the small database for user records (Firestore)

The site keeps each person's role in Firebase's own database, Firestore.

1. In the left menu, under **Build** (or **Databases**), click **Firestore Database**.
2. Click **Create database**.
   What you should see now: a few short steps. On 2026-10-19 they were **Edition**, **ID and location**,
   **Configure**, and then **Scheduled backups**.
3. **Edition:** choose **Standard**.
4. **ID and location:** keep the database ID `(default)`, and under **Location** choose **asia-south1 (Mumbai)**. It
   cannot be changed later.
5. **Configure:** when it asks how to start, choose **Start in production mode**.
6. **Scheduled backups:** this needs the paid **Blaze** plan. Skip it; leave it off.
7. Click **Create**.
   What you should see now: an empty database page with tabs such as **Data**, **Rules** and **Indexes**.

### A2.5 Copy the site's security rules into your test project

1. On this PC, open `D:\Onboarding\Repos\POCs\seva-entry` in **File Explorer**, right-click `firestore.rules`, click
   **Open with** > **Notepad**.
2. Press **Ctrl+A**, then **Ctrl+C**. Close Notepad without changing anything.
3. In Firebase, on the Firestore page, click the **Rules** tab.
   What you should see now: a text editor with a few lines of rules.
4. Click in the editor, press **Ctrl+A**, then **Ctrl+V** to replace them with the site's rules.
5. Click **Publish**.
   What you should see now: a message that the rules were published, and a new entry in the rules history.
   If it shows a red error line, stop and tell me the line number and the message (they hold no secret).

### A2.6 The service-account key file

The website's server and the build's scripts sign in to your Firebase project with a key file. This file is a secret.

Before you start: Windows hides file extensions unless you switch them on, so a file you rename to
`.firebase-adminsdk.json` can end up named `.firebase-adminsdk.json.json` without you seeing it. That wrong name is
**not** ignored by git and the build cannot find it. So first open **File Explorer**, click **View** > **Show** >
**File name extensions** (as in 0.8 step 8) and leave it on.

1. Click the gear icon next to **Project Overview**, then **Project settings**, then the **Service accounts** tab.
2. Click **Generate new private key**, then **Generate key** in the box that opens.
   What you should see now: a `.json` file in your **Downloads** folder. Firebase cannot show this file again.
3. In **File Explorer** (with **File name extensions** on, as in 0.8 step 8), move the file from **Downloads** into
   `D:\Onboarding\Repos\POCs\seva-entry`: right-click it > **Cut**, open the folder, right-click an empty space >
   **Paste**.
4. Right-click the moved file, click **Rename**, type `.firebase-adminsdk.json` (with the dot at the start), press
   **Enter**, and click **Yes** if Windows asks.
   What you should see now: `.firebase-adminsdk.json` in the seva-entry folder, and nothing left in **Downloads**.
   Check the name letter by letter: it must end in `.json` once. If it shows `.firebase-adminsdk.json.json`, rename it
   again and remove the second `.json`. Git ignores only the exact name `.firebase-adminsdk.json` in this folder.
5. Right-click `.firebase-adminsdk.json` > **Open with** > **Notepad**. Open `.env.local` in a second Notepad window.
6. Add these three lines at the end of `.env.local`:

   ```
   FIREBASE_PROJECT_ID=<your project ID>
   FIREBASE_CLIENT_EMAIL=<the value after "client_email": without its quotes>
   FIREBASE_PRIVATE_KEY="<the value after "private_key": without its quotes>"
   ```

   The private key is one long line that starts and ends with five dashes and contains `\n` marks; copy it exactly
   as it is, keep the `\n` marks, and put it between double quotes as shown.
7. Save `.env.local` (**Ctrl+S**). Close the key file's Notepad window without saving changes.
   What you should see now: `.env.local` with 12 lines: three Supabase, six `NEXT_PUBLIC_FIREBASE_`, three
   `FIREBASE_`. Never send me either file.

If steps 5 to 7 are fiddly (the private key is one very long line), you may instead ask me to add the three
`FIREBASE_` lines: I copy them from `.firebase-adminsdk.json` into `.env.local` on this PC without printing them, and
neither file leaves the PC.

### Tell me it is done

Send me this message in chat (it holds no secret; fill in the brackets):
`Section A2 done - Firebase project ID <id>, email sign-in on, Google sign-in <on or off>, rules published, key file and .env.local filled`.

## A3. Seeing the test site: on this PC or on your phone

When: at the end of wave A4, for the 10-minute check, and again in Plan B. Before that, nothing here is needed.

You can look at the test site in two ways. **Option 1 (no new account):** on this PC - I start the site and you open
it in the browser. **Option 2:** your own Vercel account (free Hobby plan) builds a preview link of **your fork** that
you can open on a phone. Option 2 is needed only if you want to check on a phone, and for the Plan B test payment.
Both use your test projects from A1 and A2.

Vendor pages read for this section:
(source: https://vercel.com/docs/git/vercel-for-github, checked 2026-10-19)
(source: https://vercel.com/docs/getting-started-with-vercel/import, checked 2026-10-19)
(source: https://vercel.com/docs/environment-variables/managing-environment-variables, checked 2026-10-18)
(source: https://vercel.com/docs/limits/fair-use-guidelines, checked 2026-10-18)

### A3.1 Option 1: check on this PC

1. Tell me you want to check on this PC. I start the site in the seva-entry folder; it reads your `.env.local`.
2. When I say it is running, open `http://localhost:3000` in the browser.
   What you should see now: the temple website's home page, running on this PC. Seva Entry itself opens at `/seva`
   (`http://localhost:3000/seva`): receptionists land on the counter, the prasadam counter on the prasadam page, and
   temple admins and super admins on the dashboard.
3. If this is the first time with your test projects, do A3.2 now.
4. Follow the checklist I give you. When you are finished, tell me and I stop the site.

### A3.2 Make yourself staff 001 on your test projects (once)

The seva module needs one first super admin. On your test projects, that is you.

1. With the site running (A3.1, or your Vercel link from A3.5), open the site's **Register** page (`/register`, for
   example `http://localhost:3000/register`) and sign up with your own email and a new password.
   What you should see now: you are signed in to the test site as an ordinary member.
2. Open a PowerShell window in `D:\Onboarding\Repos\POCs\seva-entry` (0.9).
3. Type `npx tsx scripts/seva/create-first-super-admin.ts --email <the email you just used>` and press **Enter**.
   It reads `.env.local` and `.firebase-adminsdk.json` and prints no secret.
   What you should see now: a few lines ending in a message that staff 001 was created (or already exists). If it
   prints an error, copy it (it holds no secret) and send it to me.
4. Open `http://localhost:3000/seva` (or `/seva` on your Vercel link). The public pages have no admin link and no
   sign-out, so always type the address: `/seva` for Seva Entry, `/admin` for the website admin.
   What you should see now: the Seva Entry dashboard with your name and staff number 001 in the header. If it says you
   have no access, open `/admin`, click **Sign out** in the account menu at the top right, sign in again at `/login`,
   and open `/seva` again.

### A3.3 Option 2: sign up for Vercel

1. Open `https://vercel.com/signup`.
   What you should see now: a choice between personal and commercial projects. (UNVERIFIED wording.)
2. Choose the personal (**Hobby**) choice, type your name, and click **Continue**.
3. Click **Continue with GitHub**, sign in to GitHub as `nikhilmn01` if asked, and click the green button that
   authorises Vercel.
   What you should see now: the Vercel dashboard with no projects, and a page or button to import a Git repository.
   If it asks for a card, stop: the Hobby plan needs none. Tell me what you see.

### A3.4 Import your fork

1. Click the button that adds a project (**Add New...** > **Project**, or the import page shown after sign-up).
   What you should see now: **Import Git Repository**, with an empty list or a button to install the GitHub app.
2. Click the button that installs or connects GitHub (for example **Install**, or **Adjust GitHub App Permissions**).
   What you should see now: a GitHub page about installing **Vercel** on your account.
3. Choose your account `nikhilmn01` if GitHub asks where to install.
4. Choose **Only select repositories**, open the **Select repositories** list, and pick `Rayaramathaynk`.
5. Click the green install button (**Install**, or **Install & Authorize**).
   What you should see now: back in Vercel, `Rayaramathaynk` in the list with an **Import** button next to it.
6. Click **Import**.
   What you should see now: a **Configure Project** page with **Project Name**, **Framework Preset** (it should say
   **Next.js**), **Root Directory**, **Build and Output Settings** and **Environment Variables**.
7. Leave **Project Name**, **Framework Preset**, **Root Directory** and the build settings as they are.
8. Open **Environment Variables**. For each of the 12 lines in your `.env.local`, type the name (the part before `=`)
   into **Key**, paste the value (the part after `=`; for `FIREBASE_PRIVATE_KEY`, without the outer double quotes)
   into **Value**, and click **Add**.
   (UNVERIFIED: Vercel may let you paste the whole contents of `.env.local` into the first **Key** box and fill all
   rows at once. If it does, check that each row has the right name.)
9. Click **Deploy**.
   What you should see now: a build log, and after a few minutes a page that says the project is deployed, with a
   picture of the site. This first build is of your fork's `main` branch, which does not have the seva module yet;
   that is expected.

### A3.5 A preview link of the build branch

1. When you want a phone check, tell me. With your go-ahead, the build branch `feature/seva-entry` is pushed to your
   fork. Vercel builds it on its own as a **Preview**.
2. In Vercel, open your project and click **Deployments**.
   What you should see now: a deployment for the branch `feature/seva-entry` that turns **Ready** after a few
   minutes.
3. Click it, then click the link next to **Domains** (or **Visit**).
   What you should see now: your test site at an address ending in `.vercel.app`. Vercel keeps preview links
   private: on your phone it may ask you to sign in to Vercel first. That is expected.
4. If this is the first time with your test projects, do A3.2 on this link.

Two notes:

- **Your fork's GitHub Actions stay off.** GitHub switches off workflows on a new fork ("Workflows aren't being run on
  this forked repository"). Leave them off: the site owner's jobs (daily updates, backups, deploys) belong to his
  repository, and your fork has none of his secrets.
- Vercel's Hobby plan is for personal, non-commercial use. A test copy of your own fork fits that.

### Tell me it is done

Send me this message in chat (it holds no secret; fill in the brackets):
`Section A3 done - checked on <this PC or phone>, staff 001 <yes or no>, Vercel project <name or none>`.

## A4. Cashfree test account and Expo account (later)

### A4.1 Cashfree test account (Plan B)

Written in Plan B (task B0-1), with every screen click by click. What it will cover, so you know what is coming:

1. Create a Cashfree merchant account from its sign-up page, with your own email and phone. Test mode works before
   any business papers are checked.
2. Switch the dashboard to **Test** mode and find the test App ID and Secret Key. Copy each straight into your own
   Vercel project (A3) for **Preview** only, never into chat: `PAYMENTS_PROVIDER=cashfree`, `PAYMENTS_MODE=test`,
   `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`. Then redeploy your preview.
3. Let Cashfree reach your preview: turn on Vercel's **Protection Bypass for Automation** in your own Vercel project.
4. Google sign-in in your own Firebase test project (A2.3 step 4), plus your preview's address under
   **Authentication** > **Settings** > **Authorized domains**.
5. Payment alerts need no set-up; where to see them in Cashfree's test dashboard.
6. The test UPI ids that succeed and fail, for the Plan B test payment on your preview.

The live Cashfree account, the reconcile secret and the live keys are the site owner's (B9).

### A4.2 Expo account (Plan C)

Written in Plan C (task C0-1). What it will cover: a free Expo account from its sign-up page, linking the Android app
project, a preview build (an APK file), and installing it on an Android phone.

## A5. The counter PC (for go-live at the temple)

Do this at the temple, when I tell you the counter page is ready for the print test. It uses the live website, so it
comes after the site owner has merged the pull request and done Part B. Some steps (A5.6 to A5.8) need the counter page
itself.

Why: the counter PC holds devotees' names and the day's receipts, prints the receipts without a print dialog,
and keeps an Excel copy of each day (open items O-05, O-07, O-08, O-09).

What you need: the counter PC, its printer and driver CD or download, a temple admin sign-in on the live site, about
60 minutes.

Vendor pages read for this section:
(source: https://support.microsoft.com/en-us/accounts-billing/security/sign-in-options-in-windows, checked 2026-10-18)
(source: https://support.microsoft.com/en-us/windows/device-encryption-in-windows-cf7e2b6f-3e70-4882-9532-18633605b7df, checked 2026-10-18)
(source: https://support.microsoft.com/en-us/windows/hardware/printer/set-a-default-printer-in-windows, checked 2026-10-18)
(source: https://epson.com/faq/SPT_C11C524001~faq-140652, checked 2026-10-18; dated 2009, possibly stale)
(source: https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/ux, checked 2026-10-18)
(source: https://learn.microsoft.com/en-us/deployedge/microsoft-edge-browser-policies/silentprintingenabled, checked 2026-10-18)
(source: https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api, checked 2026-10-18; dated 2024-01-09, possibly stale)

### A5.1 A Windows password for the counter account

1. Click **Start** > **Settings** > **Accounts** > **Sign-in options**.
2. Click **Password**.
   What you should see now: a button **Add** (no password yet) or **Change** (a password is already set). If it says
   **Change**, skip to A5.2.
3. Click **Add**.
4. Type a new password in both password boxes.
5. Type a hint that does not give the password away.
6. Click **Next**, then **Finish**.
   What you should see now: Windows asks for this password the next time the PC starts.
7. Write the password on paper kept in the office safe, not on the counter.

### A5.2 Encrypt the disk (BitLocker or Device encryption)

1. Click **Start** > **Settings** > **Privacy & security**.
2. Click **Device encryption**. (On Windows Pro you may instead see **BitLocker drive encryption** under
   **Settings** > **System** > **Storage** > **Advanced storage settings**, or in **Control Panel**; UNVERIFIED path.)
   If neither appears, this PC cannot encrypt; tell me in the final message ("no encryption").
3. Switch **Device encryption** to **On**.
   What you should see now: "Encrypting..." and later "On".
4. When Windows offers to save the **recovery key**, save it to a USB drive or print it, and keep it in the office
   safe, apart from any backup-key drive. Without it, a broken PC's disk cannot be read.

### A5.3 Install the printer and set the receipt paper size

The receipt paper size is chosen in Seva Entry under **Settings** (`/seva/settings`) > **Receipts**
(`/seva/settings/receipt`) > **Receipt paper**: **A5** (148 x 210 mm, the default), **A6** (105 x 148 mm),
**One-third A4** (99 x 210 mm), an **80 mm** or **58 mm** roll, or a custom size. Every size prints upright (portrait), one receipt per sheet. A5 and A6 are sizes the printer driver already
knows: for them, do steps 1 and 2, then step 9 and 10 choosing **A5** (or **A6**) as the paper size, and skip the form
in steps 3 to 8. For one-third A4 or a custom size, do every step and make the form with your size.

1. Install the printer with its driver from the maker's website or CD, as its manual says.
2. Click **Start** > **Settings** > **Bluetooth & devices** > **Printers & scanners**.
3. Scroll down to **Related settings** and click **Print server properties**.
   What you should see now: a small window with a **Forms** tab.
4. On the **Forms** tab, tick **Create a new form**.
5. In **Form name**, type `Seva slip 99x210`.
6. Under **Units**, choose **Metric**.
7. Set **Width** to `9.90cm` and **Height** to `21.00cm`. Set all four printer area margins to `0.00cm`.
8. Click **Save Form**, then **Close**.
   What you should see now: `Seva slip 99x210` in the forms list the next time you open this window.
9. Back in **Printers & scanners**, click the printer, then **Printing preferences**.
10. Set the paper size to **Seva slip 99x210** and the paper source (tray) to the **Bypass tray** (some printers call
    it **Manual feed** or **Multi-purpose tray**). Set orientation to **Portrait**.
11. Click **OK**.
    (UNVERIFIED on the temple printer: some printer drivers do not show forms made here; if the size is missing in
    step 10, tell me the printer model.)

### A5.4 Make it the default printer

1. In **Printers & scanners**, under **Printer preferences**, switch **Let Windows manage my default printer** to
   **Off**.
2. Click the printer, then click **Set as default**.
   What you should see now: "Default" under the printer's name.

### A5.5 Stop Edge running in the background

The silent printing switch only works when Edge starts fresh, so Edge must not keep running in the background.
(UNVERIFIED: the setting names below come from guides other than Microsoft's.)

1. Open **Microsoft Edge**.
2. Type `edge://settings/system` in the address bar and press **Enter**.
3. Switch **Startup boost** to **Off**.
4. Switch **Continue running background extensions and apps when Microsoft Edge is closed** to **Off**.
5. Close every Edge window.

### A5.6 Install the counter as an app

1. Open Edge and go to the counter address I give you (it ends with `/seva/counter`).
2. Sign in with your temple admin account.
3. In the address bar, click the **App available** icon, then click **Install**.
   What you should see now: the counter open in its own window, and a small window after installing. Seva Entry
   installs as one app for every role: it opens at `/seva`, which takes a receptionist to the counter (and a temple
   admin to the dashboard). Phones install the same app from `/seva` with the browser's **Install** or **Add to Home
   screen**.
4. In that small window, tick **Pin to taskbar** and leave **Auto-start on device login** unticked (the shortcut in
   A5.7 starts the counter instead).
5. Close the app window and every Edge window.

### A5.7 The kiosk-printing shortcut

1. Right-click an empty space on the desktop, then click **New** > **Shortcut**.
   What you should see now: a box "Type the location of the item".
2. Type, all on one line, with the live site's address in place of `<site>`:
   `"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk-printing --app=https://<site>/seva/counter`
3. Click **Next**.
4. In "Type a name for this shortcut", type `Seva counter`.
5. Click **Finish**.
   What you should see now: a **Seva counter** icon on the desktop.
6. Make sure every Edge window is closed, then double-click **Seva counter**.
   What you should see now: the counter page in its own window without an address bar.
7. On the counter, issue one test receipt as I describe at the print test.
   What you should see now: the slip comes out of the bypass tray with no print window on screen.
8. If a print window appears instead, tell me. The fallback is an Edge setting called "Enable Silent Printing"
   (Edge version 144 or later), which I will walk you through. (UNVERIFIED on the temple PC.)

### A5.8 Register the PC and choose the Excel folder

1. In **File Explorer**, make a folder `D:\Seva receipts` (or `C:\Seva receipts` if the PC has no D: drive).
2. Open the counter (**Seva counter** shortcut) and sign in as a temple admin.
3. Go to **Settings** > **Counters** (`/seva/settings/counters`) and click **Register this PC** for **Counter 1**.
   (UNVERIFIED: I will confirm the exact wording at the print test.)
   What you should see now: Counter 1 marked as registered to this PC.
4. On the counter, click **Choose folder**.
   What you should see now: the Windows folder picker.
5. Pick the `Seva receipts` folder and click **Select Folder**.
6. When the browser asks whether the site may view and edit files in that folder, click **Edit files** (or **Allow**).
   If it offers **Allow on every visit**, choose that.
7. Restart the PC, sign in to Windows, and open **Seva counter** again.
8. Note whether the counter asks again for the folder ("Allow saving to D:\Seva receipts"). Either way is fine; I need
   to know which (open item O-08).

### Tell me it is done

Send me this message in chat (it holds no secret; fill in the brackets):
`Section A5 done - password set, encryption <on or none>, slip printed without a dialog <yes or no>, folder asked again after restart <yes or no>`.

## Part B - For the site owner (after the pull request is merged)

**Nikhil: forward everything from here to the end of B9 to the site owner as it is.**

This part is written for **you, the person who runs the live temple website** (GitHub `ngowda759`). Nikhil built the
Seva Entry module on his fork and sent it to you as a pull request. Once you merge it, these steps switch it on in
your live accounts. Nikhil has no access to your Vercel, Firebase, Supabase or GitHub settings, and does not need any:
only you do these steps.

The one rule: **never send a key, password or connection string to anyone** - not to Nikhil, not in WhatsApp, not in
an email. Each step says where a secret goes: your Vercel project, your repository's GitHub secrets, or a git-ignored
file on your own computer. Things that are not secret (a project ref, a region, a plan name, the "Section ... done"
messages) are fine to send. If a screen looks different from a step, stop and tell Nikhil what you see; do not click
around to fix it.

Three small how-tos used below:

- **Open your repository's secrets:** `https://github.com/ngowda759/Rayaramathaynk` > **Settings** > in the left
  sidebar under **Security**, **Secrets and variables** > **Actions** > the **Secrets** tab. To add one, click **New
  repository secret**, type the **Name**, paste the value into **Secret**, and click **Add secret**. To change one,
  click the pencil icon next to it, paste the new value, and click **Update secret**. (UNVERIFIED: GitHub's page does
  not name the pencil button. If you cannot find it, delete the secret with the bin icon and add it again with the
  same name.)
- **Open your Vercel settings:** `https://vercel.com/dashboard` > the temple website project > **Settings** >
  **Environment Variables**. To change a value, click the three dots next to the name > **Edit**. To add one, use the
  form at the top. A changed value reaches the site only after a new deployment: **Deployments** > three dots on the
  newest **Production** deployment > **Redeploy** > **Redeploy**.
- **A copy of the repository on your computer** (needed for B5 and B8 only): install Git and Node.js 20 or later if
  you do not have them, open a terminal in a folder of your choice, and run
  `git clone https://github.com/ngowda759/Rayaramathaynk` and then `npm install` inside the new `Rayaramathaynk`
  folder. If you already have a copy, run `git pull` in it after the merge.

## B1. Supabase: add the new tables

Do this right after you merge. Until it is done, the new seva pages show an error; the tables it adds are new, so
nothing that already exists changes.

Vendor pages read for this section:
(source: https://supabase.com/docs/reference/cli/supabase-db-push, checked 2026-10-18)
(source: https://supabase.com/docs/guides/platform/database-size, checked 2026-10-18)
(source: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow, checked 2026-10-18)

### B1.1 Note the live project's size and region (read only)

This answers open items O-16 (region) and O-17 (database size). You only look; you change nothing.

1. Open `https://supabase.com/dashboard` and click the live temple project.
2. In the left-hand menu, click **SQL Editor**.
   What you should see now: a large text box with a **Run** button.
3. Type exactly: `select pg_size_pretty(pg_database_size(current_database()));` and click **Run**.
   What you should see now: one result row, such as `142 MB`. Write it down. This query only reads.
4. Click **Project Settings** (the gear icon), and look for **Region** on the **General** page or the
   **Infrastructure** page. (UNVERIFIED which of the two.)
   What you should see now: a region such as **South Asia (Mumbai)**. Write it down.
5. Close the SQL Editor tab without saving.

### B1.2 Apply the new tables

Your repository has a workflow for this, **Deploy Supabase Migrations**. It uses four secrets you may already have:
`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` and `SUPABASE_SERVICE_ROLE_KEY`.

1. Open your repository's secrets (how-to above).
   What you should see now: the list of secret names. If any of those four names is missing, stop and tell Nikhil
   which ones (names are not secret); he will send you the steps to add it.
2. Click **Actions** at the top of the repository.
3. In the left sidebar, click **Deploy Supabase Migrations**.
4. Click **Run workflow**, keep **Branch** as `main`, and click the green **Run workflow** button.
   What you should see now: a new run with a yellow dot that turns into a green tick after a few minutes. Its steps
   include a dry run, then "Apply Supabase migrations", then "Verify Supabase migrations".
5. If it turns into a red cross, do not run it again. Tell Nikhil the run's date and time (not its log).

### Tell Nikhil it is done

Send this message (it holds no secret; fill in the brackets): `Section B1 done - size <size>, region <region>, migrations run green`.

## B2. Firebase: publish the new rules

The build changed the Firestore rules (who may create a user record and which roles exist). Your repository has no
job that publishes them, so you publish them once by hand.

Vendor pages read for this section:
(source: https://firebase.google.com/docs/firestore/quickstart, checked 2026-10-19)

1. Open `https://github.com/ngowda759/Rayaramathaynk/blob/main/firestore.rules`.
2. Click the **Raw** button (or the copy icon at the top right of the file) and copy the whole file.
3. Open `https://console.firebase.google.com`, click the live temple project, then **Firestore Database** in the left
   menu, then the **Rules** tab.
   What you should see now: the rules your site uses today in an editor.
4. Click in the editor, press **Ctrl+A**, then **Ctrl+V**.
5. Click **Publish**.
   What you should see now: a message that the rules were published. If a red error line appears, stop and tell
   Nikhil the line number and message (they hold no secret).
6. Open the website, sign in as you normally do, and open an admin page.
   What you should see now: your usual pages with no error.

### Tell Nikhil it is done

Send this message (it holds no secret): `Section B2 done - rules published, site works`.

## B3. Replace and revoke the old Firebase key

When: after the merge, not before.

Why: an old Firebase service-account key was once written into the code, so anyone with a copy of the code could use
it (open item O-18). The merged code reads the key from a secret or a git-ignored file instead. Before the merge, 11
one-off scripts on `main` still carried the old key, so this waits for the merge; after it, nothing needs the old key.
(Nothing runs those scripts on a schedule, so the website and the nightly jobs do not depend on them either way.)

You make a new key, put it everywhere the old one is used, check the site, and only then delete the old key. Deleting
a key cannot be undone, so the order matters.

What you need: the Google sign-in that owns the Firebase project, your GitHub and Vercel sign-ins, about 30 minutes.

Vendor pages read for this section:
(source: https://docs.cloud.google.com/iam/docs/keys-create-delete, checked 2026-10-18)
(source: https://docs.cloud.google.com/iam/docs/keys-disable-enable, checked 2026-10-18)
(source: https://firebase.google.com/docs/admin/setup, checked 2026-10-18)
(source: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets, checked 2026-10-18)
(source: https://vercel.com/docs/environment-variables/managing-environment-variables, checked 2026-10-18)
(source: https://vercel.com/docs/deployments/managing-deployments, checked 2026-10-18)

### B3.1 Make the new key

1. Open `https://console.cloud.google.com/iam-admin/serviceaccounts` and sign in with the Google account that owns
   the Firebase project.
2. At the top of the page, click the project picker and choose the project with the same name as your Firebase
   project.
   What you should see now: a list of service accounts with their emails.
3. Click the email that starts with `firebase-adminsdk-`.
4. Click the **Keys** tab.
   What you should see now: the existing keys with their creation dates. Write down how many there are and their
   dates.
5. Click **Add key**, then **Create new key**, choose **JSON**, and click **Create**.
   What you should see now: a `.json` file in your **Downloads** folder. Google cannot download it again.
6. Look at the **Keys** list again. The new key's ID starts with the same 12 letters and numbers as the end of the file
   name. Write those 12 characters down so you never delete the new key by mistake. (UNVERIFIED: Google names the
   file this way today.)

(Same result from the Firebase side: Firebase console > gear > **Project settings** > **Service accounts** >
**Generate new private key** > **Generate key**.)

### B3.2 Put the new key into GitHub

1. Open your repository's secrets (how-to above).
2. Open the new `.json` file with **Notepad** (right-click > **Open with** > **Notepad**), press **Ctrl+A**, then
   **Ctrl+C**.
3. Update `FIREBASE_SERVICE_ACCOUNT_JSON` with it (pencil icon). If it is not in the list, add it with **New
   repository secret**.
   What you should see now: its "Updated" time changes to "now".
4. If the list also has `FIREBASE_SERVICE_ACCOUNT`, update it with the same whole file.
5. If the list has `FIREBASE_PRIVATE_KEY`, update it with only the text between the quotes after `"private_key":`
   (it starts and ends with five dashes; keep the `\n` marks as they are).
6. `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PROJECT_ID` stay the same. Leave them.

### B3.3 Put the new key into Vercel

1. Open your Vercel settings (how-to above).
2. If `FIREBASE_SERVICE_ACCOUNT_JSON` is listed, click its three dots > **Edit**. If not, use the form at the top,
   choose **Secret** (or tick **Sensitive**) and type `FIREBASE_SERVICE_ACCOUNT_JSON` as the **Key**.
3. Paste the whole file (still copied from B3.2) into **Value**, tick **Production** and **Preview**, and click
   **Save**.
   What you should see now: `FIREBASE_SERVICE_ACCOUNT_JSON` for Production and Preview. The website reads this name
   first.
4. If `FIREBASE_PRIVATE_KEY` is listed, edit it the same way with only the private key text (as in B3.2 step 5).
5. If `NEXT_PUBLIC_FIREBASE_PRIVATE_KEY` is listed, click its three dots > **Delete** and confirm. A name that starts
   with `NEXT_PUBLIC_` is sent to every visitor's browser, so a key must never be stored under it.
6. Close Notepad without saving. Redeploy the newest Production deployment (how-to above).
   What you should see now: a new deployment that turns **Ready** after a few minutes.

### B3.4 Check the website works with the new key

1. Open the website and sign in to the admin pages as you normally do.
2. Open **Users** (or any admin page that lists data).
   What you should see now: the usual data with no error message.
3. If you see an error, stop here. Do not delete any key. Tell Nikhil the step and the error text.

### B3.5 Delete the old key

1. Go back to the **Keys** tab of the `firebase-adminsdk-` service account (B3.1 steps 1 to 4).
2. Find each key whose ID does **not** start with the 12 characters you wrote down in B3.1 step 6 and whose creation
   date is before today.
3. If another computer or service of yours uses one of those old keys, stop and tell Nikhil first.
4. Click the bin icon (**Delete**) next to one old key.
   What you should see now: a box asking you to confirm.
5. Click **Delete**. A deleted key cannot be brought back.
6. Repeat steps 4 and 5 for each remaining old key.
   What you should see now: only the new key in the list.
7. Repeat B3.4 once more.
8. The new `.json` file: if you will do B5, move it into your copy of the repository and rename it
   `.firebase-adminsdk.json` (git ignores that exact name). Otherwise delete it: click it, hold **Shift** and press
   **Delete**, then click **Yes**.

### Tell Nikhil it is done

Send this message (it holds no secret; fill in the brackets):
`Section B3 done - new key in GitHub and Vercel; <number> old keys deleted; site works`.

## B4. Vercel settings for the live website

Vendor pages read for this section:
(source: https://vercel.com/docs/environment-variables/managing-environment-variables, checked 2026-10-18)
(source: https://vercel.com/docs/functions/configuring-functions/region, checked 2026-10-18)
(source: https://vercel.com/docs/regions, checked 2026-10-18)
(source: https://vercel.com/docs/limits/fair-use-guidelines, checked 2026-10-18)

### B4.1 Check the names the merged code reads

1. Open your Vercel settings (how-to above).
2. Check that each name below is listed for **Production**. Names starting with `NEXT_PUBLIC_` are sent to every
   visitor's browser, so they never hold a secret.

| Name | What it holds | Kind |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<live project ref>.supabase.co` | Not secret |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the live project's anon (publishable) key | Not secret |
| `SUPABASE_SERVICE_ROLE_KEY` | the live project's service_role (secret) key | Secret |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID` | the live Firebase web app's settings | Not secret |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | the new key file from B3 | Secret |
| `NEXT_PUBLIC_SITE_URL` | the website's public address, for example `https://<your domain>` | Not secret |

3. If one is missing, add it with the form at the top for **Production** (and **Preview** if your other names have
   it), choosing **Secret** or ticking **Sensitive** for the secret ones, then redeploy.
   What you should see now: every name in the table listed for Production.

Plan B adds five more later (`PAYMENTS_PROVIDER`, `PAYMENTS_MODE`, `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`,
`SEVA_CRON_SECRET`); they are set in B9, not now.

### B4.2 Check the function region and the plan

1. In the project, click **Settings** > **Functions** > **Function Regions**.
   What you should see now: the selected region. New projects start in **Washington, D.C., USA (iad1)**.
2. If your Supabase region from B1.1 is Mumbai and this is not **Mumbai, India (bom1)**, the site runs slower than it
   could. Changing it is your call; tell Nikhil both regions and he will say whether it is worth it.
3. Click your team name at the top left, then **Settings** > **Billing**, and note the plan (**Hobby** or **Pro**).
   Vercel's Hobby plan is for non-commercial use: the seva counter takes no money on the website, but online payments
   (Plan B, B9) probably need **Pro** (open item O-16). Nothing changes today.

### Tell Nikhil it is done

Send this message (it holds no secret; fill in the brackets):
`Section B4 done - names checked, function region <region>, plan <Hobby or Pro>`.

## B5. Make yourself staff 001

The seva module needs one first super admin, staff number 001. On the live site that is **Nikhil**: you run the
script below with **Nikhil's live email** (the address he signs in to the live site with). The account must already
be able to sign in to the site.

**First, give Nikhil the website admin right away** (2 minutes): open **Website admin**, then **Users**, open Nikhil's
account, set the role to **Super Admin** and click **Save**. Then run the script.

**Everyone else, including you,** is added afterwards on the **Staff and roles** page with **Onboard staff**. An email
that already has a website account (yours, another website admin's, a devotee's) can be added too: Onboard staff
shows its current role and offers **Link this account**. The person keeps their password and gets no email. The
account's email must be verified; an unverified account is refused, and the person can send themselves the
verification email again from `/seva` (**Send verification email**).

What you need: your copy of the repository (how-to above), the new key file from B3 saved in it as
`.firebase-adminsdk.json`, about 15 minutes.

1. In your copy of the repository, make a file `.env.local` with Notepad (save it with **Save as type** set to **All
   files**), holding two lines: `NEXT_PUBLIC_SUPABASE_URL=https://<live project ref>.supabase.co` and
   `SUPABASE_SERVICE_ROLE_KEY=<the live service_role key>`. Git ignores `.env.local`.
2. Open a terminal in that folder and type
   `npx tsx scripts/seva/create-first-super-admin.ts --email <Nikhil's live email>`, then press **Enter**.
   It prints no secret.
   What you should see now: a message that staff 001 was created. If it prints an error, send Nikhil the error text
   (it holds no secret).
3. Nikhil signs out of the website and signs in again.
   What he should see now: a **Seva Entry** item in the admin menu; it opens `/seva`. From here, everyone else is
   added on the **Staff and roles** page.
4. Delete `.env.local` (click it, hold **Shift**, press **Delete**, click **Yes**) unless you will run another script
   soon.

### Tell Nikhil it is done

Send this message (it holds no secret): `Section B5 done - staff 001 created`.

## B6. The backup key

Every night a GitHub job copies the whole database, locks it with public "lock" keys, and keeps the locked file for
30 days (open item O-15). The private "unlock" key that matches any one of those public keys can open it. If every
copy of every unlock key is lost, the backups cannot be opened.

Vendor pages read for this section:
(source: https://github.com/FiloSottile/age, checked 2026-10-18)

### B6.1 Who holds a key

**Two keys** (chosen 2026-10-19): one for you and one for Nikhil, each with his own key pair.

- `age` locks each backup once for several keys, and either private key opens it alone. So either of you can do the
  restore drill (B8), and losing one key still leaves the other.
- Each of you makes his own key pair in B6.2 on his own computer. The public half is safe to share: Nikhil sends you
  his public key (`age1...`) and keeps his private key himself. Nobody ever sends a private key.
- In B7.1 you put **both** public keys into the one secret, separated by a space.

And where each holder keeps his private key: **a USB drive in a safe place** (better two drives in two places), or
**a password manager** (as a secure note or an attached file). Never on a website, in email, or in a synced folder.

### B6.2 Make a key pair (each key holder does this on his own computer)

1. Click **Start**, type `Terminal`, and click **Terminal**.
2. Type `winget install --id FiloSottile.age` and press **Enter**.
   What you should see now: a download and "Successfully installed". If it asks to accept terms, type `Y`.
3. Close the Terminal window and open a new one.
4. Type `age --version` and press **Enter**.
   What you should see now: a version number such as `v1.2.1`.
5. Plug in the USB drive and note its letter in **File Explorer** (for example **E:**). Type `cd E:\` (your letter)
   and press **Enter**. (Keeping the key in a password manager instead: still make it on the USB drive, then attach
   the file to a secure note and delete it from the drive.)
6. Type `age-keygen -o seva-backup-key.txt` and press **Enter**.
   What you should see now: one line that starts with `Public key: age1` followed by many letters and numbers.
7. Select the `age1...` text (from `age1` to the end of the line) and press **Ctrl+C**. This public key is safe to
   share; it cannot open anything. The site owner pastes his own public key into Notepad for B7.1; Nikhil sends his
   public key to the site owner, who pastes it on the same Notepad line after a space.
8. For a second copy: plug in a second drive and copy `seva-backup-key.txt` onto it in **File Explorer**. Label each
   drive "Seva backup key - do not format", eject them (**Safely Remove Hardware**), and keep them in two different
   places, never with the counter PC.

Never open `seva-backup-key.txt` in an editor that syncs to the internet, never email it, and never paste its contents
anywhere. It holds the private unlock key.

### Tell Nikhil it is done

Send this message (it holds no secret; fill in the brackets): `Section B6 done - two keys, my key kept on <USB or password manager>, Nikhil's public key received`.

## B7. GitHub secrets on your repository

All of these go into **your** repository's secrets (how-to above), never into Nikhil's fork.

| Name | What it holds | When |
|---|---|---|
| `SEVA_BACKUP_AGE_RECIPIENT` | both `age1...` public keys from B6 (yours and Nikhil's), separated by a space | Now |
| `SEVA_BACKUP_DB_URL` | the live database's Session pooler connection string with the password in it (steps below) | Now |
| `FIREBASE_SERVICE_ACCOUNT_JSON` (and `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_PRIVATE_KEY` if you have them) | the new key | Done in B3 |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY` | for the **Deploy Supabase Migrations** workflow | Checked in B1 |
| `SEVA_CRON_SECRET` (secret) and `SEVA_SITE_URL` (a **variable**, on the **Variables** tab) | the payment check every 5 minutes | Later, in B9 |

Vendor pages read for this section:
(source: https://supabase.com/docs/guides/database/connecting-to-postgres, checked 2026-10-18)
(source: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets, checked 2026-10-18)
(source: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow, checked 2026-10-18)

### B7.1 The backup public keys

1. In the Notepad window from B6.2 step 7, check the one line: your `age1...` key, one space, then Nikhil's `age1...`
   key. (A comma or a new line between the two keys also works. Both start with `age1`, in small letters. A line in
   capital letters is the secret line of a key file, a private key: never share it. Stop, close Notepad without
   saving, and do not put it anywhere.)
2. Press **Ctrl+A**, then **Ctrl+C**.
3. Open your repository's secrets and click **New repository secret**.
4. In **Name**, type `SEVA_BACKUP_AGE_RECIPIENT`.
5. Click in **Secret** and press **Ctrl+V**.
6. Click **Add secret**.
   What you should see now: `SEVA_BACKUP_AGE_RECIPIENT` in the list.
7. Close Notepad and click **Don't save**.

The first step of every backup run checks the secret and its log says `2 age public keys are well formed.` If it says
`1 age public key`, only one key went in: open the secret, click **Update**, and paste both keys again. A key added
later opens only the backups made after it; older backups open only with the keys they were made with.

### B7.2 The database connection string

The nightly job reads the live database through Supabase's **Session pooler** address (port 5432), because GitHub's
computers need the older kind of internet address (IPv4).

1. Open `https://supabase.com/dashboard`, click the live temple project, then **Connect** at the top of the page.
   What you should see now: a window with several connection strings.
2. Choose **Session pooler**. (UNVERIFIED: it may sit under a **Method** or **Type** drop-down.)
   What you should see now: a string like
   `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-<n>-<region>.pooler.supabase.com:5432/postgres`.
3. Click **Copy**, open **Notepad**, and press **Ctrl+V**.
4. Replace `[YOUR-PASSWORD]` (with the square brackets) by the live database password. If the password has any of
   `@ : / ? # & %` or a space, stop and ask Nikhil for help with the special writing first (do not send him the
   password). If you do not know the password, do not reset it without thinking: other things use it.
5. Press **Ctrl+A**, then **Ctrl+C**.
6. In GitHub, click **New repository secret**, type `SEVA_BACKUP_DB_URL` in **Name**, paste into **Secret**, and click
   **Add secret**.
   What you should see now: `SEVA_BACKUP_DB_URL` in the list.
7. Close Notepad and click **Don't save**. The string must not stay in a file.

### B7.3 First backup run

1. Click **Actions** at the top of the repository.
2. In the left sidebar, click the backup workflow (its name contains "backup").
3. Click **Run workflow**, keep **Branch** as `main`, and click the green **Run workflow** button.
   What you should see now: a new run with a yellow dot that turns into a green tick after a few minutes. From now on
   it runs by itself every night at 02:30 India time.
4. If it turns into a red cross, tell Nikhil the run's date and time (not its log).

### Tell Nikhil it is done

Send this message (it holds no secret): `Section B7 done - both backup secrets added, first backup run green`.

## B8. Restore drill (once a month)

Who: whoever holds a backup key (B6). Once a month, and once before go-live, check that the latest backup opens with
the key. About 20 minutes; it changes nothing anywhere.

What you need: your key (USB drive or password manager), a copy of the repository (how-to above; Nikhil can use his
seva-entry folder), your GitHub sign-in.

Vendor pages read for this section:
(source: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts, checked 2026-10-18)
(source: https://github.com/actions/upload-artifact, checked 2026-10-18)
(source: https://www.postgresql.org/download/windows/, checked 2026-10-18)
(source: https://enterprisedb.com/docs/supported-open-source/postgresql/installing/windows, checked 2026-10-18)

### B8.1 One-time: install the PostgreSQL command line tools

1. Open `https://www.enterprisedb.com/downloads/postgres-postgresql-downloads`.
2. In the **Windows x86-64** column, click the download for the highest version listed.
3. Run the installer and click **Next** on the first screens.
4. On **Select Components**, untick **PostgreSQL Server**, **pgAdmin 4** and **Stack Builder**, and keep **Command Line
   Tools** ticked. (UNVERIFIED: if the installer will not continue without the server, keep it ticked; it does no
   harm.)
5. Click **Next** until **Finish**. Untick the offer to launch Stack Builder.
   What you should see now: a folder `C:\Program Files\PostgreSQL\<version>\bin`. Write down the version number.

Also install `age` once, as in B6.2 steps 1 to 4, if this computer does not have it.

### B8.2 Download the latest backup

1. Open `https://github.com/ngowda759/Rayaramathaynk` and click **Actions**.
2. In the left sidebar, click the backup workflow, then the newest run with a green tick.
   What you should see now: the run's summary page with an **Artifacts** section near the bottom.
3. In **Artifacts**, click the one named `seva-<date>` (the newest date).
   What you should see now: a `.zip` file in your **Downloads** folder. (UNVERIFIED: GitHub lets anyone signed in
   download artifacts of a public repository. If there is no download for you, ask the site owner to download it.)
4. Make a new folder `C:\SevaDrill`. Right-click the `.zip` file, click **Extract All**, choose `C:\SevaDrill`, and
   click **Extract**.
   What you should see now: two files in `C:\SevaDrill`: one ending in `.dump.age` and one ending in `.sha256`.

### B8.3 Open it with the key

1. Plug in the USB drive with your key and note its letter (for example `E:`). (Key in a password manager: save the
   attached file into `C:\SevaDrill` for the drill, and delete it in step 7.)
2. In **File Explorer**, open your copy of the repository, then `scripts`, then `seva`.
   What you should see now: a file `verify-backup.sh`. If it is missing, run `git pull` in the repository first.
3. Go back up twice to the repository folder, right-click an empty space, click **Show more options**, then **Open
   Git Bash here**.
   What you should see now: a window with a `$` sign at the end of the last line.
4. Type `export PATH="$PATH:/c/Program Files/PostgreSQL/<version>/bin"` with your version number from B8.1, and press
   **Enter**.
5. Type `bash scripts/seva/verify-backup.sh /c/SevaDrill/<file name>.dump.age /e/seva-backup-key.txt` (your file name
   and your drive letter in small letters, or `/c/SevaDrill/seva-backup-key.txt`) and press **Enter**.
   What you should see now: `Checksum: matches the .sha256 file`, `Decryption: ok (whole file)`, then
   `Archive entries: <n>`, `Schemas: <n>`, `Tables: <n>` (above 0), and lines for table data, sequences, functions,
   indexes, triggers and row-level security policies. It prints no names or phone numbers.
   If the first line says `Checksum: not checked (no .sha256 file next to the backup)`, the drill still counts.
   If a line starts with `verify-backup:` instead, the drill failed: send that one line (it holds no secret).
6. Close Git Bash, eject the USB drive, and put it back in its place.
7. Delete `C:\SevaDrill` and the `.zip` in **Downloads**: click each one, hold **Shift**, press **Delete**, click
   **Yes**.

### Tell Nikhil it is done

Send this message (it holds no secret; fill in the brackets): `Section B8 done - backup of <date> opened, counts shown`.

## B9. Cashfree live (later)

Written in Plan B (task B0-1), for after the Plan B pull request is merged. What it will cover:

1. Before going live: the temple's own Cashfree account with its activation papers (trust deed or registration
   certificate, 80G/12A, trust PAN, bank details), Cashfree's written answer on UPI charges up to Rs 2,000, the CA's
   answers (open items O-13, O-14), and the Vercel plan (B4.2).
2. The reconcile secret: a long random `SEVA_CRON_SECRET` in your Vercel project (**Production**) and the same value
   as a secret in your repository, plus a repository **variable** `SEVA_SITE_URL` with the site's address. The
   5-minute payment check runs only from `main`.
3. In your Vercel project, for **Production**: `PAYMENTS_PROVIDER=cashfree`, `PAYMENTS_MODE=live`, and the live
   `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY`; then **Redeploy**.
4. One small real payment, check its receipt, and refund it.
