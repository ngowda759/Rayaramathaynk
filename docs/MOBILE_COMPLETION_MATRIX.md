# Mobile Completion Matrix

This matrix documents the actual functionality currently present in `apps/mobile/`.

| Feature | Status | Notes |
|---------|--------|-------|
| **Home** | DONE | Implemented with static information + settings API integration |
| **Temple** | PARTIAL | Basic settings shown, but might lack rich detail/history |
| **Events** | DONE | Fetches and renders events via API (`/sevas/events`) |
| **Sevas (Listing)** | DONE | Fetches from API, filters with search bar |
| **Seva detail** | MISSING | `sevas/[id].tsx` missing or incomplete |
| **Seva booking** | MISSING | No booking form/API call |
| **Gallery** | MISSING | Not found in current codebase |
| **Gallery detail** | MISSING | Not found in current codebase |
| **Panchanga** | MISSING | Not found |
| **Announcements** | MISSING | Not found |
| **Donations** | MISSING | Not found |
| **Raya AI** | MISSING | Not found in mobile app |
| **Notifications** | MISSING | Not configured |
| **Offline/cache** | MISSING | No offline persistence mechanism visible |
| **Localization** | MISSING | Hardcoded English |
| **Authentication** | N/A | No user accounts required |
| **Supabase integration** | PARTIAL | Basic API fetches are present, full native integration lacking |
| **API integration** | PARTIAL | Basic fetches mapped in `lib/api.ts` |
| **Error handling** | PARTIAL | `console.error` mainly; no user-facing error UI |
| **Loading states** | DONE | `ActivityIndicator` implemented on lists |
| **Empty states** | DONE | Basic empty text implemented on lists |
| **Security** | NEEDS_VALIDATION | Standard, no obvious glaring issues but not formally reviewed |
| **Testing** | MISSING | No tests present in `apps/mobile` |
| **Android build** | NEEDS_VALIDATION | `expo export -p android` requires checking |
| **iOS build** | NEEDS_VALIDATION | `expo export -p ios` requires checking |
| **CI/CD** | MISSING | No mobile CI workflow |
