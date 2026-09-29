# Mobile Application Integration

This PR introduces the Expo/React Native mobile application under `apps/mobile/`.

The mobile app provides native mobile views for the following functionalities:
- Temple Home Page
- Temple Information
- Sevas
- Events
- Panchanga
- Gallery
- Raya AI Chat

It integrates seamlessly with the existing Supabase/backend services.

The mobile project includes independent Expo TypeScript and ESLint validation and has been verified with `expo export` and `expo-doctor` checks.

This PR strictly contains the mobile application source files and does not modify any root application files, except for configuring the TS compiler (`tsconfig.json`) to exclude the `apps/mobile/` directory since it uses a different ecosystem.

## Technical Notes

The change to the root `tsconfig.json` was strictly limited to:
`"exclude": ["apps/mobile/**/*", ...]`
This exclusion is genuinely required because the root Next.js TypeScript environment cannot typecheck the Expo/React Native project without conflicting with Next.js/React DOM specific typings.
