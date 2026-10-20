# Brief - V1: test the expert skill as a cold user

Read `.claude/state/briefs/RULES.md` first. Then this.

## Goal

Prove or break the claim that `.claude/skills/temple-portal-expert/` answers real questions about
this codebase by routing to the right brain file and confirming in code. Fix routing defects in the
skill; report content defects in the brain files.

## Inputs

```
.claude/skills/temple-portal-expert/SKILL.md      the protocol - follow it exactly, as a user who has never seen this repository
.claude/skills/temple-portal-expert/MIND-MAP.md   the router
.claude/skills/temple-portal-expert/brain/*.md    open only what the router sends you to
the repository code                                for the confirmation step the protocol requires
```

Do not read chunks.json, the briefs or the verify reports first - a real user would not have them.

## Method

1. Read SKILL.md and MIND-MAP.md once. Then answer these 10 questions strictly by the protocol
   (route -> brain section -> confirm in code -> answer with path:line), recording for each: the
   router row used, the brain file and section opened, files opened for confirmation, turns taken,
   and the verdict - ROUTED-AND-CORRECT / ROUTED-BUT-BRAIN-WRONG (say what) / NOT-ROUTABLE /
   ANSWERED-FROM-CODE-ONLY.
   1. How does a devotee book a seva, end to end, and what gets written where?
   2. Where is the admin sidebar menu defined, and how do I add an entry?
   3. Which Firestore collections or Supabase tables does the donation flow write to?
   4. How does Raya AI decide which knowledge source to use for a question?
   5. How are the daily panchanga files produced, and when does the data run out?
   6. Which API routes accept writes without any authentication check?
   7. Where are the site's colours defined, and which files would a palette change touch?
   8. How are receipts numbered and turned into PDFs?
   9. What is the migration state of sevas between Firestore and Supabase?
   10. Which parts of the app have no automated tests at all?
2. Add 5 questions of your own of a different shape: one "what breaks if I change X", one "explain
   this file" for a file you pick at random from components/, one about a domain word (glossary),
   one about a specific route path, one about a type. Same recording.
3. Judge the skill text itself against the writing-skills guidance a skill author would use:
   is the description a trigger list; is the body under 500 words; are the red flags real
   failure modes; is the worked example concrete.
4. **Fix routing defects in place**: a question that was NOT-ROUTABLE gets a router row; a route
   or store missing from the indexes gets added; a glossary gap gets filled; an unclear protocol
   step gets rewritten. Re-read each file from disk before editing. You may edit only SKILL.md,
   MIND-MAP.md and README.md. Brain content errors are reported, not fixed.
5. Write `.claude/state/verify/V1-skill-qa.md`: the 15-row results table, the skill critique, the
   list of edits you made, and the brain defects you found (file, section, what is wrong, evidence).

## Done means

- The report exists with 15 rows, each with a verdict and the files opened.
- Every NOT-ROUTABLE question now has a router row (re-run those questions once).

## Output contract - structured return

```
questions, routedAndCorrect, routedButBrainWrong, notRoutable, answeredFromCodeOnly,
routingEditsMade, brainDefects: [{file, section, issue, evidence}], skillBodyWords,
file (report path), notes (<=8 lines)
```
