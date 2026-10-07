# Task Brief: AI-007 - Implement Festival Photo Highlights Component

**Phase:** feature
**Status:** approved

## Summary
Implement a festival photo highlights component for major temple festivals to fulfill the next milestone in the v2.0 Experience roadmap.

## Acceptance Criteria
- Create a new component `FestivalPhotoHighlights` in `components/festival/FestivalPhotoHighlights.tsx`.
- The component must display a grid or carousel of at least 3 static photo highlights when rendered.
- Integrate the `FestivalPhotoHighlights` component into `components/festival/FestivalExperience.tsx` beneath the `SeasonGrid` section.
- Running `npm run type-check` returns 0 errors.
- Running `npm run lint` returns 0 errors.
- A new unit test in `tests/unit/components/festival/FestivalPhotoHighlights.test.tsx` runs successfully via `npm run test` and verifies that the photo images are rendered on the page.

## Out of Scope
- Mobile implementation
- Dynamic auto-generation of albums from backend APIs (static/mocked photos are sufficient for foundation)
- Admin UI to upload the photos

## References
- `docs/ROADMAP.md`
