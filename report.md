# FIRESTORE HEALTH AUDIT

## Overall diagnosis:
* Quota exhaustion: **NOT EVIDENCED**
* Configuration issue: **NOT EVIDENCED**
* Rules issue: **CONFIRMED** - There is a confusion between `dailyPoojas` and `sevas`. Some places use `dailyPoojas` for sevas (e.g. `SevaBooking.tsx`), while admin panel code sometimes accesses `sevas` directly. `pooja.service.ts` uses `dailyPoojas` but `seva.service.ts` uses `sevas`.
* Code/query issue: **CONFIRMED** - `useDonationNotifications` polls `donations` every 60 seconds. The `poojaService.getPoojas` is called on component mount for `SevaBooking` but the problem is it maps to `dailyPoojas` instead of `sevas`. More importantly, `ReceiptSevas` use `/api/admin/receipt-sevas` to load `sevas` collection, but public `SevaBooking` maps to `dailyPoojas` via `poojaService`.
* Recent regression: **POSSIBLE** - `dailyPoojas` vs `sevas` separation might be recent.

## AFFECTED DATA FLOW
The Sevas feature has disjointed data flows:
1. Public booking (`SevaBooking.tsx`) uses `poojaService.getPoojas()` which reads from the `dailyPoojas` collection.
2. The Admin Receipt creation (`CreateReceiptPage`) fetches sevas from `/api/admin/receipt-sevas`, which reads the `sevas` collection using admin privileges.
3. The Admin "Sevas" pages (`app/admin/sevas/page.tsx`) seems to use `volunteer.service.ts` which actually points to `users` and `volunteers` collections, creating more confusion. Wait, the `app/admin/sevas/page.tsx` code I grepped had `VolunteerPage` code in it (copy-paste error in the file?).

There is no single truth for "Sevas", and the data might exist in `sevas` but public booking reads `dailyPoojas`, resulting in empty lists if `dailyPoojas` is empty.

## HIGHEST READ-COST OPERATIONS

| File | Function | Collection | Read pattern | Risk |
|------|----------|------------|--------------|------|
| `hooks/useDonationNotifications.ts` | `fetchDonations` | `donations` | `getDocs` polling every 60s | High (1440 reads/user/day) |
| `app/api/public/stats/route.ts` | `GET` | `donations` | `getDocs` on full collection | Medium (scales with donations) |
| `app/admin/featured/page.tsx` | `loadFeaturedItems` | multiple | 4 concurrent `getDocs` | Low (Admin only) |
| `services/ai-analytics.service.ts` | various | various | multiple `getDocs` | Low (Admin only) |

## SEVAS DROPDOWN
The `SevaBooking` component loads data via `poojaService.getPoojas()`. `poojaService.getPoojas()` queries the `dailyPoojas` collection (`collection(db, "dailyPoojas")`).
However, the admin panel's receipt creation fetches data from `/api/admin/receipt-sevas`, which reads the `sevas` collection.
If an admin adds a Seva, it goes to `sevas`.
If a user goes to book a Seva, the app reads `dailyPoojas`.
Because they read different collections, the Sevas dropdown on the public page appears empty.

Furthermore, `poojaService.getPoojas()` catches errors and could swallow them.

## QUOTA RISK
The free-tier quota is 50,000 reads/day.
The `useDonationNotifications` polls every 60 seconds and fetches up to 20 documents. If a user leaves the page open, they generate 20 * 60 = 1200 reads per hour. With just 5 active users keeping the tab open for an 8-hour workday, that's 5 * 1200 * 8 = 48,000 reads, which exhausts the quota.
Additionally, `/api/public/stats` fetches the entire `donations` collection to calculate unique donors: `await getDocs(donorsQuery)`. If there are 10,000 donations, every page load querying stats consumes 10,000 reads. 5 page loads = quota exhausted.

Therefore, quota exhaustion is **HIGHLY LIKELY** under minimal traffic.

## EVIDENCE
- `hooks/useDonationNotifications.ts`: `setInterval(fetchDonations, 60000)` and `getDocs(query(..., limit(20)))`
- `app/api/public/stats/route.ts`: `const donorsSnapshot = await getDocs(donorsQuery);`
- `components/home/SevaBooking.tsx`: `const data = await poojaService.getPoojas();`
- `services/pooja.service.ts`: `const COLLECTION_NAME = "dailyPoojas";`
- `app/api/admin/receipt-sevas/route.ts`: `const RECEIPT_SEVAS_COLLECTION = "sevas";`

## RECOMMENDED FIXES
1. **Remove full collection read in stats**: Refactor `/api/public/stats/route.ts` to use an aggregation function, a cloud function to maintain a counter, or `getCountFromServer` with distinct users if possible.
2. **Remove aggressive polling**: Refactor `useDonationNotifications` to use `onSnapshot` with a tight `where` clause, or remove polling completely and rely on a longer interval/cache.
3. **Consolidate Sevas collections**: Unify `sevas` and `dailyPoojas` or clearly document/route the difference. The public booking page must read from the same collection the admin writes to.
