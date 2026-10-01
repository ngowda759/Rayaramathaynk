import * as fs from "fs";
import * as path from "path";
import { getAdminFirestore } from "../lib/admin-firebase";

const COLLECTIONS = [
  "donations",
  "donationCampaigns",
  "donation_campaigns",
  "sevaBookings",
  "profiles",
  "bookmarks",
  "settings",
  "homepage",
  "announcements",
  "gallery",
  "timings",
  "temple_areas",
  "poojas",
  "dailyPoojas",
  "galleryAlbums",
  "galleryMedia",
  "panchanga",
  "quotes",
  "featuredContent",
  "futurePlans",
  "trustCommittee",
  "trust",
  "bills",
  "receiptSevas",
  "receipts",
  "volunteers",
  "members",
  "ai_settings",
  "ai_token_usage",
  "messages",
  "chat_metrics",
  "intent_metrics",
  "intent_feedback",
  "page_views",
  "daily_page_stats",
  "feedback",
  "notifications",
  "knowledge",
  "knowledge_articles",
  "knowledge_categories",
  "knowledge_workflow",
  "knowledge_versions",
  "knowledge_workflow_actions",
  "knowledge_review_comments",
  "knowledge_committee_approvals",
  "knowledge_audit_log",
  "knowledge_drafts"
];

async function run() {
  console.log("Initializing Admin SDK to perform read-only counts...");

  try {
    const db = await getAdminFirestore();
    console.log("Authentication successful.");

    let markdown = `# Firestore Production Counts for REVIEW Scope\n\n`;
    markdown += `| Collection | Production Document Count |\n`;
    markdown += `|---|---|\n`;

    const results: Record<string, number | string> = {};

    for (const c of COLLECTIONS) {
      try {
        const snapshot = await db.collection(c).count().get();
        const count = snapshot.data().count;
        markdown += `| ${c} | ${count} |\n`;
        results[c] = count;
        console.log(`Counted ${c}: ${count}`);
      } catch (e: any) {
        markdown += `| ${c} | ERROR: ${e.message} |\n`;
        results[c] = `ERROR: ${e.message}`;
        console.error(`Failed to count ${c}:`, e.message);
      }
    }

    markdown += `\n## Special Checks\n`;

    // Check settings docs
    try {
      const settingsSnap = await db.collection("settings").select().get();
      const docs = settingsSnap.docs.map(d => d.id);
      markdown += `\n### Settings Documents\n`;
      markdown += `Found ${docs.length} documents in \`settings\` collection:\n`;
      docs.forEach(d => markdown += `- ${d}\n`);
    } catch (e: any) {
      markdown += `\n### Settings Documents\nERROR fetching settings: ${e.message}\n`;
    }

    // Check homepage docs
    try {
      const homeSnap = await db.collection("homepage").select().get();
      const homeDocs = homeSnap.docs.map(d => d.id);
      markdown += `\n### Homepage Documents\n`;
      markdown += `Found ${homeDocs.length} documents in \`homepage\` collection:\n`;
      homeDocs.forEach(d => markdown += `- ${d}\n`);
    } catch (e: any) {
      markdown += `\n### Homepage Documents\nERROR fetching homepage: ${e.message}\n`;
    }

    // Determine output paths
    const workspacePath = process.env.GITHUB_WORKSPACE || process.cwd();
    const outputPath = path.join(workspacePath, "firestore-counts-report.md");

    fs.writeFileSync(outputPath, markdown, "utf8");
    console.log(`\nReport written to ${outputPath}`);

    // Write to step summary if in Actions
    if (process.env.GITHUB_STEP_SUMMARY) {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
    }

    console.log("READ-ONLY execution completed. No writes were performed.");

  } catch (error: any) {
    console.error("Authentication or Initialization Failed:", error.message);
    process.exit(1);
  }
}

run();
