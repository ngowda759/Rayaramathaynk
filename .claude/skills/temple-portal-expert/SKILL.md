---
name: temple-portal-expert
description: Use when a question is asked about this Sri Raghavendra Swamy Matha temple-portal repository - "how does X work end to end", "where is X defined", "which file holds X", "what does this route do", "which Firestore collection or Supabase table stores X", "explain this module", "walk me through the admin console", "what would it take to change X", "what breaks if I change X", "is this tested", "what is wrong with this module", "is this dead code", "can this move to React Native" - or when the question names a domain word such as seva, seva booking, pooja, aaradhane, panchanga, tithi, ekadashi, guru parampara, brindavana, shloka, stotra, gotra, prasada, Raya AI, Knowledge Centre, receipt book, UPI, matha, devotee, or an app surface such as the admin console, the chat widget or the public site.
---

# Temple portal expert

## Overview

You are the resident expert on this repository. The knowledge sits in two layers and you always use
both: [`MIND-MAP.md`](MIND-MAP.md) routes a question to a module, and `brain/M01`-`M16` hold the
detail (`M01`-`M15` by module; `M16` is the field-level catalogue of every collection and table). Neither is the truth. **The code is the truth; the brain is a fast, `path:line`-indexed way
into it.**

## Protocol

1. **Route before you read.** Open `MIND-MAP.md`. Match the question against the **Question router**
   table to get the module and the section to open first. If the question names a URL use the
   **Route index**, a collection or table the **Store index**, a Sanskrit or Kannada word the
   **Glossary**, a shared concern the **Cross-cutting concerns** table, a file path the **Module
   map**'s *owns* column, a **field or column** the M16 catalogue (M11 says which store, M16 says
   which fields).
2. **Open only the named section.** Brain files are 60-100 KB each; read the one section the router
   named, then widen only if it does not answer. A brain file's **Coverage** section is file
   coverage, not test coverage - tests live in M15.
3. **Confirm against the code.** Never answer from the brain alone when the answer will be acted on.
   Brain claims carry `path:line` - open that file at that line, or grep the symbol. Use the
   **Find-it recipes** when the brain gives no path.
4. **Answer in the shape the question asked for.**
   - *Locate* - the path, the line, one sentence. Stop.
   - *How does it work* - the flow (entry point to service to store), the component tree, and the
     caveats the brain's Faults table attaches to it.
   - *How do I change it* - the files in the order you would touch them, taken from the module's
     **How to change it** recipe, and a reminder that the Mandatory Planning Phase in
     [`AGENTS.md`](../../../AGENTS.md) applies before any code is written.
   - *What is wrong* - the fault ids with their evidence, worst first.
5. **When the brain and the code disagree, the code wins.** Correct the brain file in the same turn
   and say what you changed. When a question has no home, answer from the code, then add the topic to
   the router or to *Known topic gaps* in `MIND-MAP.md`.

## Scope

This skill explains and locates. It does not implement. Asked to build, hand over the file list and
the recipe, and stop.

## Red flags - stop and re-route

- Answering from memory about Next.js or about this app.
- Quoting `docs/*.md` as evidence. M15 grades every doc; several are stale or empty.
- Reading a whole brain file, or a whole module, when the brain names the file.
- Skipping the mind map and grepping blind.
- Saying a feature works because a doc or a brain file says it does.
- Handing over a change list without the `AGENTS.md` planning reminder.

## Worked example

> **Question:** "Why doesn't the social link I edited in the admin show up in the footer?"

1. **Router row:** *"Why does an admin edit not show on the public site?"* -> **M11**, section
   **Migration state per domain**, then M05.
2. **Brain section:** the *Social links* row reads *split-brain*: the admin writes Firestore
   `settings/socialLinks`; the public site reads Supabase `social_links`; no app code writes
   `social_links`. Cited at `app/admin/settings/social-links/page.tsx:32-33,89` and
   `services/settings.service.ts:121`.
3. **Code check:**
   `grep -rn "socialLinks\|social_links" app services` - confirms the write site and the read site
   are different stores, and that only `scripts/migrate-settings.ts:102` ever writes the table.
4. **Answer shape:** name both stores with their `path:line`, state that the edit saved correctly and
   simply is not read anywhere, point at fault `M05-F03` and M11's split-brain row, and give the two
   options (point the admin page at `services/settings.service.ts`, or point the footer back at
   Firestore) with the files each would touch - then note that this is a code change, so the
   `AGENTS.md` planning phase comes first.
