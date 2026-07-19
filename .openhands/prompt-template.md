# OpenHands Prompt Template

Use this template when starting new tasks with OpenHands.

---

## Task Prompt Template

```
## Task: [Brief title]

## Context
[Explain what needs to be done and why]

## Requirements
- [Requirement 1]
- [Requirement 2]
- [Requirement 3]

## Constraints
- [Constraint 1]
- [Constraint 2]

## Success Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## References
- Relevant files: [file1], [file2]
- Documentation: [doc links]
- Related issues: [issue numbers]

## Notes
[Any additional context or special instructions]
```

---

## Example Prompts

### Feature Implementation

```
## Task: Add event search functionality

## Context
Users need to find events by name and date. This is part of v2.0 roadmap.

## Requirements
- Search by event title (partial match)
- Filter by date range
- Results should be paginated
- Use existing search component

## Constraints
- Must use existing event service
- Follow CODING-STANDARDS.md patterns
- Mobile responsive required
- No new dependencies

## Success Criteria
- [ ] Search returns matching events
- [ ] Date filter works correctly
- [ ] Empty state shown when no results
- [ ] Mobile responsive
- [ ] Build passes
- [ ] Tests added
```

### Bug Fix

```
## Task: Fix booking form validation error

## Context
The booking form shows "Invalid date" error when selecting dates in the future.

## Requirements
- Date validation should accept future dates
- Error message should be user-friendly
- Should work on mobile

## Success Criteria
- [ ] Future dates are accepted
- [ ] Error message is clear
- [ ] Mobile tested
- [ ] No console errors
```

### Code Review

```
## Task: Review PR #45 - Event calendar integration

## Context
This PR adds the new calendar component to the events page.

## Focus Areas
- Type safety
- Performance implications
- Accessibility
- Alignment with UI-GUIDELINES.md

## Success Criteria
- [ ] All issues documented
- [ ] Suggestions provided
- [ ] Security concerns flagged if any
```
