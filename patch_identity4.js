const fs = require('fs');
let code = fs.readFileSync('lib/seva/server/identity-firebase.ts', 'utf-8');

code = code.replace(/async function userDoc\(externalUid: string\) \{[\s\S]*?\}\n\n/, "");

code = code.replace(/  async getAccessProfile\(externalUid\) \{[\s\S]*?return \{ role: data\.role, isActive: data\.isActive === true \};\n  \},/, `  async getAccessProfile(externalUid) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("users")
      .select("role, active")
      .eq("firestore_id", externalUid)
      .maybeSingle();

    if (!data) return null;
    return { role: data.role, isActive: data.active === true };
  },`);

code = code.replace(/  async setAccessProfile\(externalUid, patch\) \{[\s\S]*?\}\,/, `  async setAccessProfile(externalUid, patch) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    
    // Check if the user exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("firestore_id", externalUid)
      .maybeSingle();
      
    const write: Record<string, unknown> = {};
    if (patch.role !== undefined) write.role = patch.role;
    if (patch.isActive !== undefined) write.active = patch.isActive;
    if (patch.email !== undefined) write.email = patch.email;
    if (patch.displayName !== undefined) write.display_name = patch.displayName;
    
    if (existingUser) {
      await supabase.from("users").update(write).eq("firestore_id", externalUid);
    } else {
      write.firestore_id = externalUid;
      await supabase.from("users").insert(write);
    }
  },`);

fs.writeFileSync('lib/seva/server/identity-firebase.ts', code);
