# Sri Raghavendra Swamy Temple App

This directory contains the cross-platform Expo React Native application for Sri Raghavendra Swamy Temple, Yelahanka New Town.

## Architecture

* **Framework**: React Native + Expo
* **Navigation**: Expo Router (File-based routing via `app/`)
* **Styling**: Tailwind CSS via NativeWind
* **Backend**: Supabase PostgreSQL + Next.js API Routes
* **Authentication**: Currently restricted to unauthenticated public queries only for temple information.

## Current Limitations
* **Push Notifications**: UI scaffolding is in place via `expo-notifications`, however, actual backend push notification delivery and device-token persistence are NOT implemented. This requires an EAS (Expo Application Services) account setup with APNs/FCM credentials to complete.
* **Native Builds**: Javascript bundles export correctly, but to produce physical `.apk`/`.aab` or `.ipa` files, you must run `eas build` with active Apple Developer and Google Play Console certificates.

## Environment Setup
Create a \`.env\` file in \`apps/mobile/\` modeled off the repository root's environment.

\`\`\`env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_API_URL=https://www.srsmathaynk.com
\`\`\`
*Warning: NEVER use the Supabase Service Role key inside the mobile directory!*

## Local Development
Run the expo command to begin:
\`npx expo start\`

## Production Build
To check the JavaScript export configuration:
\`npx expo export -p ios\`
\`npx expo export -p android\`
