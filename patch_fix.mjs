import fs from 'fs';
import path from 'path';

const files = [
  "app/admin/ai/health/page.tsx",
  "app/admin/ai/settings/page.tsx",
  "app/admin/ai/page.tsx",
  "app/admin/ai/intents/page.tsx",
  "app/admin/ai/prompts/page.tsx",
  "app/admin/ai/knowledge/page.tsx",
  "app/admin/ai/playground/page.tsx",
  "app/admin/ai/unknown-questions/page.tsx"
];

for (const file of files) {
  const filePath = path.resolve(file);
  let content = fs.readFileSync(filePath, 'utf-8');

  // The error complains about 'use client' not being the very first statement.
  // Currently, the patch added:
  // import { useAdminFetch } ...
  // "use client";

  // We need to swap them.
  const importStr = 'import { useAdminFetch } from "@/hooks/useAdminFetch";\n';

  if (content.startsWith(importStr)) {
      // Remove the import from the top
      content = content.substring(importStr.length);

      // Find where "use client"; is
      const useClientMatch = content.match(/"use client";\s*\n/);
      if (useClientMatch) {
          const insertIndex = useClientMatch.index + useClientMatch[0].length;
          content = content.slice(0, insertIndex) + importStr + content.slice(insertIndex);
      } else {
          // If no use client, just put it at the top
          content = importStr + content;
      }

      fs.writeFileSync(filePath, content);
      console.log(`Fixed ${file}`);
  }
}
