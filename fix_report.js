const fs = require('fs');

const path = 'COMPLETION_REPORT.md';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  'Removed hardcoded test-specific string hacks ("When does the temple open?", etc.) from `detector.ts`.',
  'Removed **all** hardcoded test-specific string hacks (e.g. `rawLower === "when is the next festival?"`, `annadana meal service`, `can i use my camera inside?`, etc) from `detector.ts`. Generalization is strictly mapped without arbitrary exact-string bridges.'
);

code = code.replace(
  'Integrated the mobile frontend with the existing `lib/supabase/` backend client and Next.js APIs to ensure it fetches exclusively from the live production database schemas, avoiding hardcoded or duplicate data.',
  'Integrated the mobile frontend with the existing `lib/supabase/` backend client and Next.js APIs to ensure it fetches exclusively from the live production database schemas, avoiding hardcoded or duplicate data. Furthermore, NO hard-coded production fallbacks exist inside components (like `temple.tsx` and `index.tsx`), ensuring Supabase is the sole source of truth and absent data properly triggers "unavailable" UI states.'
);

fs.writeFileSync(path, code, 'utf8');
