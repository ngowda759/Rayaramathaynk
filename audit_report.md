# Vercel Blob Audit Report

## 1. Every file using Vercel Blob
- `services/storage.service.ts`
- `app/(public)/gallery/page.tsx`
- `app/api/reports/list/route.ts`
- `app/api/reports/save/route.ts`
- `app/api/storage/videos/route.ts`
- `package.json`
- `next.config.ts`
- `.env.example`

## 2. What operation it performs
- `services/storage.service.ts`: Implements all interactions with Vercel Blob (`put`, `list`, `del`), handling image, video, file, and report uploads and listing.
- `app/(public)/gallery/page.tsx`: Uses `list` directly to fetch video blobs from the `gallery/videos/` prefix.
- `app/api/reports/list/route.ts`: API endpoint to list reports, calls `storageService.listReports()`.
- `app/api/reports/save/route.ts`: API endpoint to save reports (screenshots, PDFs), calls `storageService.saveReport()`, etc.
- `app/api/storage/videos/route.ts`: API endpoint to list videos, calls `storageService.listVideos()`.
- `package.json`: Contains `@vercel/blob` dependency.
- `next.config.ts`: Contains CSP rules and image optimization domains for `*.blob.vercel-storage.com` and `*.public.vercel-storage.com`.
- `.env.example`: Documents `BLOB_STORE_ID` and `BLOB_READ_WRITE_TOKEN`.

## 3. Which bucket/folder/path it uses
- `gallery/videos/` (used for Gallery videos)
- `gallery/` (general file uploads)
- `testimonials/` (default for `uploadBase64Image`)
- `reports/` (used for system reports, screenshots, PDFs)
- Can be overridden by callers (`videos`, `aaradhane`, `events`, `profile`, `donations`, `sevas`)

## 4. Whether it runs client-side or server-side
- `storage.service.ts`: Mostly server-side or intended for server-side given the token usage, BUT it exposes `storageService` which might be imported anywhere. However, Vercel Blob's `put`/`list`/`del` with a static token typically requires server-side execution.
- `app/(public)/gallery/page.tsx`: This is a `"use client"` component. It calls `list` directly from `@vercel/blob`! This implies the Next.js app has been exposing the Vercel Blob token to the client, or using client upload. We need to route this through an API or use Supabase client appropriately.
- `app/api/...`: Server-side API routes.

## 5. Whether authentication/authorization is involved
- `storage.service.ts` uses `access: 'public'` for all `put` operations.
- The gallery fetch is public.
- The admin API endpoints are protected by standard Next.js middleware or route handlers (though the actual storage is public in Vercel Blob).

## 6. Whether the stored URL is persisted in Supabase/PostgreSQL
- Yes, likely in `testimonials`, `events`, `sevas`, etc. The migration should account for this, although we can't delete production records. The instructions say "Do NOT delete Vercel Blob files automatically" and "Provide a migration mechanism".

## 7. Whether existing stored Vercel Blob URLs need migration
- Yes, we must not break existing records that point to `*.blob.vercel-storage.com`.
- The instruction states: "Provide a migration mechanism from Vercel Blob -> Supabase Storage... If downloading existing Vercel Blob files requires credentials unavailable in the repository, document exactly what is required instead of pretending the migration is complete."
- Wait, I shouldn't execute an automatic data migration of existing database URLs unless I can download the files, but I don't have the real `BLOB_READ_WRITE_TOKEN`. I will create a utility script to handle this data migration, but leave it as a manual step for the user to run with real credentials.

## 8. Any Vercel-specific configuration that must be removed
- `next.config.ts`: Remove `*.blob.vercel-storage.com`, `*.public.vercel-storage.com` and `*.vercel-storage.com` from `img-src`, `media-src`, `connect-src` and `remotePatterns`. Add Supabase domains instead.
- `vercel.json`: Can be removed if not needed (it has some cache headers, we'll keep it or move it to next.config.js, let's just keep the headers for Render/others by translating them to `next.config.ts` headers, and remove `vercel.json`).
- `package.json`: Remove `@vercel/blob` and `@vercel/analytics`.

## 9. Any potentially missed indirect dependency
- `@vercel/analytics`: Need to remove from `package.json`, and check if it's imported anywhere (None found in source files except `package.json`).
- `storageService` usages: `services/testimonial.service.ts`, `components/admin/gallery/GalleryDashboard.tsx`, `components/admin/gallery/VideosManager.tsx`, `components/ui/ImageUploader.tsx`, `components/ui/VideoUploader.tsx`. These all need to work seamlessly with the refactored `storageService`.
