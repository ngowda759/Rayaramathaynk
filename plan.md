1. **Analyze Requirements:**
   - Create `FestivalCountdown` component.
   - Display days, hours, and minutes until upcoming festival.
   - Use static/config data (already exists via `getFeaturedFestival` in `types/festival.ts`).
   - Integrate into homepage/temple explorer.
   - Write unit tests.
   - Run typecheck and lint (ensure 0 errors).
   - Pre-commit step

2. **Completed Actions:**
   - Updated `types/festival.ts` to improve `calculateCountdown` helper to consider "today" without timezone discrepancies.
   - Created `FestivalCountdown` at `components/festival/FestivalCountdown.tsx` matching UI styling from existing `EventCountdown`.
   - Created `FestivalCountdownWrapper` at `components/festival/FestivalCountdownWrapper.tsx` that fetches `featuredFestival` and wraps the countdown logic securely for SSR compatibility vs hydration.
   - Integrated into homepage by adding `FestivalCountdownWrapper` inside `UpcomingEvents.tsx`.
   - Fixed the `EventCountdown` component to resolve cascading update errors found during `npm run lint`.
   - Setup jest configuration to handle React / jsdom.
   - Wrote unit tests for `FestivalCountdown` in `tests/unit/components/festival/FestivalCountdown.test.tsx` and ensured they pass.
   - Ran `npm run lint` and `npm run typecheck` - verified 0 errors related to our changes.

3. **Remaining Actions:**
   - Verify `EventCountdown.tsx` tests are still passing? Or verify functionality since we touched it.
   - Call `pre_commit_instructions` tool to run and adhere to automated checks and validations.
   - Submit.
