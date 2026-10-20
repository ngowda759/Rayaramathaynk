# Standing rules for this knowledge base

These bind every session and every agent that works in this repository. They were set by Nikhil and
are repeated in the repository's `CLAUDE.md`, which every session loads.

## 1. This repository is a standalone proof of concept - never mix it with office work

Recorded 2026-10-18, verbatim intent: *"this is a POC completely outside of the application or workflow
that I work on. Never, I repeat, never mix the two."*

- The office work is the Lifecycle / Onboarding application, the CONA repository, CoreFlex Solutions
  deliverables and the Architect Rulings page. None of it applies here.
- Never offer, ask about, read from or write to the Architect Rulings page from this repository.
  Anything pending on Nikhil stays in the chat reply or in `docs/overview/KNOWLEDGE-BASE-GUIDE.md`
  section 5.
- Never apply the CoreFlex house theme, the CoreFlex presentation skill, CoreFlex naming or office
  report formats to anything produced here. HTML pages use this site's own tokens from
  `app/globals.css` and its own fonts (Playfair Display, Inter, Noto Sans Kannada).
- Never carry office-repo briefs, rulings files, task sheets or commands into this repository, and
  never reference this repository from them.
- The user-level CLAUDE.md defaults that point at office conventions are overridden for this folder
  by the repository's `CLAUDE.md`. If a default and this file disagree, this file wins.

## 2. The brain is derived from code, not from docs

Every claim carries a `path:line`. When the brain and the code disagree, the code wins and the brain
is corrected in the same turn. Existing `docs/*.md` are documented intent and are graded against
the code, never copied as fact.

## 3. Refresh before trusting after a gap

The date line at the top of `MIND-MAP.md` says when the brain last matched the code. For anything
built after that date, run the refresh recipe in `docs/overview/KNOWLEDGE-BASE-GUIDE.md` section 4,
or answer from the code and update the one module touched.

## 4. Orchestrated runs launch from the repository root

The working directory at the moment a workflow is launched becomes the agents' working directory.
Launch from the root, and pass absolute paths in `args`.
