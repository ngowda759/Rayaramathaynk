# Task Brief: AI-006 - Implement Festival Live Updates Component

**Phase:** feature
**Status:** proposed

## Summary
Implement live text/photo updates for major temple festivals to fulfill the next milestone in the v2.0 Experience roadmap.

## Acceptance Criteria
- Create a new component `FestivalLiveUpdates` that displays a timeline or feed of recent text and photo updates during a festival.
- Integrate the updates component appropriately into the festival experience or live page.
- Use static or mock data to represent a stream of live updates (e.g., "Abhisheka started", "Maha Mangalarati").
- Running `npm run type-check` returns 0 errors.
- Running `npm run lint` returns 0 errors.
- Unit tests run successfully via `npm run test` (or Vitest equivalent) to verify component rendering.

## Out of Scope
- Mobile implementation
- Real-time pushing/websockets (a static/mocked feed component is sufficient for the foundation)
- Admin UI to create the updates

## References
- `docs/ROADMAP.md`
