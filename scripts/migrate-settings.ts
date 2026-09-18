import { getAdminFirestore } from "@/lib/admin-firebase";
import { createAdminClient } from "@/lib/supabase/admin";

async function migrateSettings() {
  console.log("Starting Settings migration from Firestore to Supabase...");

  const isDryRun = process.argv.includes("--dry-run");

  if (isDryRun) {
    console.log("--------------------------------------------------");
    console.log("DRY RUN MODE ENABLED - No data will be written to Supabase");
    console.log("--------------------------------------------------");
  }

  const firestore = await getAdminFirestore();
  const supabase = createAdminClient();

  const settingsSnapshot = await firestore.collection("settings").get();

  if (settingsSnapshot.empty) {
    console.log("No settings documents found in Firestore.");
    return;
  }

  console.log(`Found ${settingsSnapshot.docs.length} settings documents in Firestore.`);

  let siteSettingsDoc = null;
  let socialLinksDoc = null;
  let otherDocsCount = 0;

  for (const doc of settingsSnapshot.docs) {
    if (doc.id === "socialLinks") {
      socialLinksDoc = { id: doc.id, ...doc.data() };
    } else if (doc.id !== "socialLinks") {
      // Typically, there's just one main settings doc, but let's grab the first one that has templeName etc.
      if (doc.data().templeName || doc.data().contactEmail) {
         siteSettingsDoc = { id: doc.id, ...doc.data() };
      } else {
         otherDocsCount++;
      }
    }
  }

  console.log(`Found site settings doc: ${siteSettingsDoc ? 'Yes' : 'No'}`);
  console.log(`Found social links doc: ${socialLinksDoc ? 'Yes' : 'No'}`);
  console.log(`Other setting documents: ${otherDocsCount}`);

  // Migrate Site Settings
  if (siteSettingsDoc) {
     const mappedSiteSettings = {
         firestore_id: siteSettingsDoc.id,
         temple_name: siteSettingsDoc.templeName || 'Sri Raghavendra Swamy Temple',
         contact_email: siteSettingsDoc.contactEmail || 'info@example.com',
         contact_phone: siteSettingsDoc.contactPhone || '',
         address: siteSettingsDoc.address || '',
         footer_text: siteSettingsDoc.footerText || null,
         welcome_message: siteSettingsDoc.welcomeMessage || null,
         updated_at: siteSettingsDoc.updatedAt ? new Date(siteSettingsDoc.updatedAt._seconds * 1000).toISOString() : new Date().toISOString()
     };

     if (isDryRun) {
         console.log("\n[DRY RUN] Would insert Site Settings:");
         console.log(JSON.stringify(mappedSiteSettings, null, 2));
     } else {
         const { error } = await supabase
            .from("site_settings")
            .upsert(mappedSiteSettings, { onConflict: "firestore_id" });

         if (error) {
             console.error("Failed to migrate Site Settings:", error);
         } else {
             console.log("✅ Successfully migrated Site Settings.");
         }
     }
  }

  // Migrate Social Links
  if (socialLinksDoc) {
      const mappedSocialLinks = {
         firestore_id: socialLinksDoc.id,
         facebook: socialLinksDoc.facebook || null,
         instagram: socialLinksDoc.instagram || null,
         youtube: socialLinksDoc.youtube || null,
         whatsapp: socialLinksDoc.whatsapp || null,
         twitter: socialLinksDoc.twitter || null,
         linkedin: socialLinksDoc.linkedin || null,
         map_url: socialLinksDoc.mapUrl || null,
         show_facebook: socialLinksDoc.showFacebook ?? true,
         show_instagram: socialLinksDoc.showInstagram ?? true,
         show_youtube: socialLinksDoc.showYoutube ?? true,
         show_whatsapp: socialLinksDoc.showWhatsapp ?? true,
         show_twitter: socialLinksDoc.showTwitter ?? false,
         show_linkedin: socialLinksDoc.showLinkedin ?? false,
         show_map: socialLinksDoc.showMap ?? true,
      };

      if (isDryRun) {
         console.log("\n[DRY RUN] Would insert Social Links:");
         console.log(JSON.stringify(mappedSocialLinks, null, 2));
      } else {
         const { error } = await supabase
            .from("social_links")
            .upsert(mappedSocialLinks, { onConflict: "firestore_id" });

         if (error) {
             console.error("Failed to migrate Social Links:", error);
         } else {
             console.log("✅ Successfully migrated Social Links.");
         }
      }
  }

  console.log("\nMigration completed.");
}

migrateSettings().catch(console.error);
