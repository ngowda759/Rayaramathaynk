# Rayara Matha Yelahanka New Town Mobile App

The official mobile app for Sri Raghavendra Swamy Mutt, Yelahanka New Town.
Built using React Native, Expo, and Supabase.

## Setup

1. Install dependencies:
\`\`\`bash
npm install --legacy-peer-deps
\`\`\`

2. Configure environment variables in an \`.env\` file in this directory (or the root if using Expo configuration):
\`\`\`
EXPO_PUBLIC_SUPABASE_URL="YOUR_SUPABASE_URL"
EXPO_PUBLIC_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
\`\`\`

3. Start development server:
\`\`\`bash
npx expo start
\`\`\`

## Build for Production

This application uses Expo.

### iOS
\`\`\`bash
npm run build
# OR via EAS
eas build --platform ios
\`\`\`

### Android
\`\`\`bash
npm run build -- -p android
# OR via EAS
eas build --platform android
\`\`\`

## Architecture

- **Supabase Integration:** Hooks into the exact same \`sevas\`, \`events\`, \`announcements\`, and \`gallery_media\` backend as the Next.js website.
- **Raya AI Integration:** Directly interfaces with the \`/api/chat\` endpoint from the root Next.js app to preserve structured knowledge retrieval and server-side safety boundaries.
