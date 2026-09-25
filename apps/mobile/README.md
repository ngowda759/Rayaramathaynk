# Rayara Math Mobile App

This is the mobile application for the Rayara Math Temple built using Expo, React Native, and Expo Router.

## Getting Started

### Local Development

1. Run `npm install` inside the `apps/mobile` directory.
2. Ensure environment variables are configured. Create an `.env` file with:
   ```
   EXPO_PUBLIC_SUPABASE_URL="your-supabase-url"
   EXPO_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
   EXPO_PUBLIC_API_URL="https://www.srsmathaynk.com" # Or your local backend proxy
   ```
3. Run `npm start` to open the Expo development server.

### Directory Structure

* `app/`: Contains the Expo Router screen definitions (`_layout.tsx`, `(tabs)/*`).
* `assets/`: Contains images, icons, fonts, and the temple logos.
* `lib/`: Contains backend configuration including `supabase.ts` and data fetching logic in `api.ts`.
* `components/`: UI components (if separated in future).

### Push Notifications
The app uses `expo-notifications`. Configuration is added in `app.json`. To fully enable:
1. Ensure Firebase/APNs keys are registered in the Expo project dashboard.
2. Request permissions on app load (to be implemented in `_layout.tsx` when needed).

### iOS & Android Build
To build for production, we use EAS (Expo Application Services):
- Ensure `eas-cli` is installed (`npm install -g eas-cli`).
- Run `eas build --platform ios`
- Run `eas build --platform android`
