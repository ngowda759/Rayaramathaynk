# Development Rules — Rayaramathaynk

These rules are mandatory for all development, automation, and AI pair-programming tasks in this repository. They take precedence over assumptions and generic workflows.

---

## Mandatory Engineering & Safety Rules

1. **Work Only on the Current Feature Branch:**
   Never work on or switch to `main` unless explicitly instructed. Keep work confined to the assigned feature/task branch (`antigravity-work`).

2. **Never Modify or Push Directly to Main:**
   Direct pushes or destructive operations against `main` are strictly forbidden. All production promotions occur via pull requests.

3. **Never Create Commits Unless Explicitly Requested:**
   Do not commit changes autonomously. Only stage or commit files when the user explicitly provides instructions to do so.

4. **Never Modify Unrelated Files:**
   Keep changes scoped strictly to the task. Do not reformat, refactor, or clean up unrelated code or comments.

5. **Do Not Perform Unnecessary Full-Repository Scans:**
   Rely on existing documentation (`docs/antigravity/*`, `docs/ARCHITECTURE.md`) and targeted queries instead of grepping or listing the entire repository.

6. **Inspect Only Files Directly Relevant to the Task:**
   Minimize token usage and context churn by opening only the specific files required for the immediate task.

7. **Keep Responses Concise:**
   Provide clear, structured, and actionable output. Avoid repetitive summaries, prose padding, and unsolicited essays.

8. **Prefer the Lowest-Cost / Free Available LLM Model:**
   Always use the most cost-effective model (e.g., Gemini Flash) suitable for the complexity of the task.

9. **Use Low Thinking Effort Unless Deeper Reasoning is Genuinely Required:**
   Reserve extended or high thinking budgets strictly for complex debugging, algorithmic design, or difficult multi-file architectural tasks.

10. **Do Not Intentionally Use Paid AI Credits or Paid Model Overages:**
    Optimize token consumption to remain within free / included tiers. Avoid heavy repeated prompts.

11. **Before Making Changes, Briefly Identify the Files That Will Be Changed and Why:**
    State the target files and the rationale before executing file creations, modifications, or deletions.

12. **Make the Smallest Appropriate Change:**
    Prefer minimal, surgical diffs over large rewrites. Preserve existing architecture and coding patterns.

13. **Run Only Relevant Tests Unless a Full CI Run is Explicitly Requested:**
    Execute specific unit or integration test files corresponding to modified components. Do not run full test suites (e.g. Playwright E2E or long DB suites) unless specifically requested.

14. **Never Expose, Print, or Commit Secrets, Tokens, Passwords, API Keys, or Environment Values:**
    Keep credentials out of logs, artifacts, scripts, and committed files. Always load sensitive parameters from environment variables.

15. **Never Modify Production Configuration or Production Data Without Explicit Approval:**
    All database migrations, environment configurations, and production endpoints require verified approval before application.

16. **If Requirements Are Ambiguous, Stop and Ask Instead of Assuming:**
    When requirements conflict with existing architecture or lack critical detail, ask clarifying questions before writing code.

17. **Preserve Existing Working Functionality Unless the Requested Task Explicitly Changes It:**
    Never break backward compatibility or degrade existing user flows. Verify that surrounding features continue to function as expected.
