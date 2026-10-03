import re

with open("lib/supabase/migration-helpers.ts", "r") as f:
    content = f.read()

# Replace return to exclude excludedMalformed
content = content.replace("return { ok: missing === 0, accountedFor, missing, details, excludedMalformed: input.excludedMalformed };", "return { ok: missing === 0, accountedFor, missing, details };")

# Remove excludedMalformed from ReconciliationResult
content = content.replace("export interface ReconciliationResult {\n  ok: boolean;\n  accountedFor: number;\n  missing: number;\n  details: string;\n  excludedMalformed: number;\n}", "export interface ReconciliationResult {\n  ok: boolean;\n  accountedFor: number;\n  missing: number;\n  details: string;\n}")

with open("lib/supabase/migration-helpers.ts", "w") as f:
    f.write(content)
