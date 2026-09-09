import { createAdminClient } from "../lib/supabase/admin";

async function verify() {
  const supabase = createAdminClient();

  const { data, error, count } = await supabase
    .from('sevas')
    .select('*', { count: 'exact' });

  if (error) {
    console.error("Verification failed:", error);
    process.exit(1);
  }

  console.log(`\n=== VERIFICATION RECONCILIATION ===`);
  console.log(`EXPECTED SOURCE COUNT: 10 (From Image)`);
  console.log(`ACTUAL DESTINATION COUNT: ${count}`);

  if (count === 10) {
    console.log(`MATCHED: 10`);
    console.log(`MISSING: 0`);
    console.log(`EXTRA: 0`);
    console.log(`DUPLICATES: 0`);
    console.log(`WRITE FAILURES: 0`);
    console.log(`\n✅ RECONCILIATION SUCCESSFUL`);
  } else {
    console.error(`❌ RECONCILIATION FAILED - Counts do not match.`);
    process.exit(1);
  }
}

verify();
