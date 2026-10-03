# Development Automation Architecture

This document describes the automated development loop used in the `Rayaramathaynk` repository.

## Architecture & Roles

The system uses a combination of AI agents and GitHub Actions to automate development, review, and merging, while keeping humans in control of final approvals.

1. **ChatGPT (Architect / Designer)**
   Responsible for high-level requirements, architecture, task decomposition, and maintaining the development plan. It writes the task briefs.
2. **Jules / OpenHands (Software Engineer)**
   Acts as the implementer. Receives tasks, writes code, creates tests, and opens Pull Requests. Also responsible for fixing issues flagged in review.
3. **OpenRouter (Independent Engineering Reviewer)**
   An external AI model (via OpenRouter API) that reviews the code objectively. It checks for correctness, security, architecture, and regressions. It produces a strict `PASS/FAIL` verdict.
4. **GitHub Actions (Orchestrator)**
   Manages state transitions. It detects new tasks, runs CI checks, triggers reviews, and advances to the next task upon merge, and prevents duplicate/stale tasks.
5. **Human (Final Authority)**
   Responsible for product decisions, verifying major architecture decisions, and explicitly merging ALL final Pull Requests to `main`.

## Workflow

1. **Task Selection**: The state machine identifies the next task and dispatches it to Jules.
2. **Implementation**: Jules opens a Pull Request with the implementation.
3. **CI**: GitHub Actions runs the standard checks (`npm run lint`, `npm run typecheck`, etc.).
4. **Review**: GitHub Actions triggers the OpenRouter reviewer.
   - If **FAIL**: The feedback is given to Jules to fix on the same PR.
   - If **PASS**: The PR is marked as `ai-ready` (ready for merge) and the automated loop **stops**.
5. **Merge Gate**: OpenRouter approval makes the PR eligible for merge but does not merge it. A human must review and manually merge the PR.
6. **Task Advancement**: Once human merge occurs, GitHub Actions detects it, updates `.ai/state/loop-state.json`, and automatically dispatches the next task.

## State Management

State is persisted across runs in the `.ai/` directory:
- `.ai/state/loop-state.json`: Global state, history, and status.
- `.ai/state/task-queue.json`: Generated backlog.
- `.ai/development-plan.json`: Current macro-phase tracking.

## Failure Recovery

- If a workflow hangs, check the GitHub Actions tab.
- Manually run the `AI loop next task` workflow with a reason to unstuck the state machine.
- Verify `loop-state.json` matches the actual repository state.

## Required Secrets

- `OPENROUTER_API_KEY`: For the reviewer model.
- `OPENHANDS_API_KEY`: For the OpenHands backend, if used.

*NOTE*: Never expose these in client-side code or logs.
