# Standing rules for every agent in this run

Repository root: `D:\Onboarding\Repos\POCs\General Purpose POCs Git Connected` (all relative paths
below are from here). It is a git clone on branch `feature/temple-portal-knowledge-base`. The
2026-09-19 snapshot the brain files were first written from is read-only at
`D:\Onboarding\Repos\POCs\General Purpose POCs`.
Use the date your dispatch gives you wherever a date is written (first run 2026-09-19, refresh 2026-10-18).

- **Git:** read-only git commands (`log`, `diff`, `show`, `status`, `blame`) are fine and useful.
  Never commit, branch, checkout, push, pull, rebase, stash or reset.
- **Write only under the output paths your brief names.** Do not edit application code, existing
  docs, configs or anything adjacent. If you see something worth fixing elsewhere, record it in your
  return under `notes`, do not fix it.
- **Do not install anything.** `node_modules` is absent and must stay absent: no `npm install`,
  `npm ci`, `npx`, `pnpm`, `npm run build/lint/test/typecheck`. Static reading only. Plain `node`
  scripts using only built-in modules (`fs`, `path`) are fine for counting and parsing.
- **Do not read credentials.** Never open `.env`, `.env.local`, `*.firebase-adminsdk*.json` or any
  key file. `.env.example` is fine.
- **No network writes, no deploys, no Firestore or Supabase calls, no external APIs.** The single
  exception is the UI redesign agent, which may use WebSearch/WebFetch to look at public reference
  websites, read-only.
- **Do not open binary or bulk files.** Never read images, PDFs, fonts, `.xlsx`, or more than three
  of the 730 files under `data/panchanga`. Count and sample; never bulk-load.
- **Re-read a file from disk immediately before editing it.** Several agents run at once.
- **If a hook blocks a Bash command**, use the PowerShell tool, or run Python through it.
- **Work alone. Do not ask questions. Do not spawn subagents.** Where something is genuinely
  ambiguous, write `UNCLEAR: <what and why>` in your output and carry on.
- **Evidence is `path:line`, a count, or a command's output.** A document's claim that something
  exists or works is not evidence. When an existing doc and the code disagree, the code is the truth
  and the disagreement is a finding.
- **This run produces documentation and analysis, not application code.** The Mandatory Planning
  Phase in AGENTS.md does not apply to your task. AGENTS.md and `docs/*.md` are the yardstick you
  grade the code against, not instructions for you to follow.
- **Your final text is a return value read by a script, not a message to a person.** Return exactly
  the structured fields asked for. The long output goes to the file your brief names.
