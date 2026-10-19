## Fix Vercel Production Build Failure — Noto Sans Kannada / Turbopack

**Root Cause:**
The Vercel production build fails when Turbopack tries to resolve `@vercel/turbopack-next/internal/font/google/font` for the `Noto_Sans_Kannada` font configured with multiple weights (`next/font/google queries have exactly one entry`). This is a known issue with the `@next/font` Turbopack loader and Google Fonts subsets/weights processing.

**Fix Details:**
Instead of downgrading Next.js or fundamentally altering the configuration, the fix bypasses the Google Font loader for `Noto_Sans_Kannada` while preserving the Google Font loader for the English typography (`Inter`, `Playfair_Display`).

* Downloaded `Noto Sans Kannada` font files (`.ttf`) directly from Google Fonts (weights 400, 500, 600, 700).
* Placed the font assets in `public/fonts/`.
* Updated `app/layout.tsx` to use `localFont` from `next/font/local` pointing to these local assets.
* The CSS variables and font fallbacks within `globals.css` were preserved, meaning zero visual changes to Kannada text rendering or the broader website theme.

**Validation:**
* Clean dependency installation passes.
* Production build (`npm run build`) via Turbopack now compiles successfully in ~34s without module resolution errors.
* Static analysis (`npm run typecheck`, `npm run lint`) completely passes.
* All existing tests pass.
* Introduced a dedicated regression test (`tests/unit/kannada-font-regression.test.tsx`) that verifies the layout correctly injects the Kannada local font alongside the Google fonts.
