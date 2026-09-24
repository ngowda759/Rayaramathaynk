export type MigrationClassification = "MIGRATE" | "EXCLUDE_AUTH" | "EXCLUDE_SYSTEM" | "REVIEW";

export interface InventoryItem {
  collection: string;
  classification: MigrationClassification;
  destinationTable?: string;
  reason?: string;
}

// Strictly authentication data
export const EXCLUDED_AUTH_COLLECTIONS = ["users", "sessions"];

export const MIGRATION_INVENTORY: InventoryItem[] = [
  // EXCLUDE_AUTH
  ...EXCLUDED_AUTH_COLLECTIONS.map(col => ({
    collection: col,
    classification: "EXCLUDE_AUTH" as MigrationClassification,
    reason: "Auth-related: owned by Firebase Auth, excluded from application data migration",
  })),

  // EXCLUDE_SYSTEM
  { collection: "system", classification: "EXCLUDE_SYSTEM", reason: "System metadata" },
  { collection: "chatTraining", classification: "EXCLUDE_SYSTEM", reason: "Internal AI training data" },

  // MIGRATE
  { collection: "sevas", classification: "MIGRATE", destinationTable: "sevas" },
  { collection: "dailyPoojas", classification: "MIGRATE", destinationTable: "daily_poojas" },
  { collection: "events", classification: "MIGRATE", destinationTable: "events" },
  { collection: "galleryAlbums", classification: "MIGRATE", destinationTable: "gallery_albums" },
  { collection: "galleryMedia", classification: "MIGRATE", destinationTable: "gallery_media" },
  { collection: "testimonials", classification: "MIGRATE", destinationTable: "testimonials" },
  { collection: "aaradhane", classification: "MIGRATE", destinationTable: "aaradhanes" },
  { collection: "aaradhanes", classification: "MIGRATE", destinationTable: "aaradhanes" },
  { collection: "volunteer_requests", classification: "MIGRATE", destinationTable: "volunteer_requests" },
  { collection: "chat_sessions", classification: "MIGRATE", destinationTable: "chat_sessions" },
  { collection: "chat_messages", classification: "MIGRATE", destinationTable: "chat_messages" },
  { collection: "unknown_questions", classification: "MIGRATE", destinationTable: "unknown_questions" },
  { collection: "ai_intent_distribution", classification: "MIGRATE", destinationTable: "ai_intent_distribution" },
  { collection: "ai_latency_records", classification: "MIGRATE", destinationTable: "ai_latency_records" },

  // REVIEW (Legacy/Removed modules or require explicit approval before migration)
  { collection: "donations", classification: "REVIEW", reason: "Investigate if still used in active application/schema" },
  { collection: "donationCampaigns", classification: "REVIEW", reason: "Investigate if still used in active application/schema" },
  { collection: "donation_campaigns", classification: "REVIEW", reason: "Investigate if still used in active application/schema" },
  { collection: "sevaBookings", classification: "REVIEW", reason: "Investigate if still used in active application/schema" },
  { collection: "profiles", classification: "REVIEW", reason: "Application data linked to auth but not strictly auth credentials. Confirm migration necessity." },
  { collection: "bookmarks", classification: "REVIEW", reason: "Application data linked to auth but not strictly auth credentials. Confirm migration necessity." },
  { collection: "settings", classification: "REVIEW", reason: "Requires conflict/mapping verification with homepage" },
  { collection: "homepage", classification: "REVIEW", reason: "Requires conflict/mapping verification with settings" },

  // REVIEW (Other)
  { collection: "announcements", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "gallery", classification: "REVIEW", reason: "Legacy gallery? Replaced by galleryAlbums?" },
  { collection: "timings", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "temple_areas", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "poojas", classification: "REVIEW", reason: "Duplicate/Legacy of dailyPoojas?" },
  { collection: "panchanga", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "quotes", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "featuredContent", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "futurePlans", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "trustCommittee", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "trust", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "bills", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "receiptSevas", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "receipts", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "volunteers", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "members", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "ai_settings", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "ai_token_usage", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "messages", classification: "REVIEW", reason: "Legacy messages?" },
  { collection: "chat_metrics", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "intent_metrics", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "intent_feedback", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "page_views", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "daily_page_stats", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "feedback", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "notifications", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "knowledge", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "knowledge_articles", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "knowledge_categories", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "knowledge_workflow", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "knowledge_versions", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "knowledge_workflow_actions", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "knowledge_review_comments", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "knowledge_committee_approvals", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "knowledge_audit_log", classification: "REVIEW", reason: "No destination model explicitly defined" },
  { collection: "knowledge_drafts", classification: "REVIEW", reason: "No destination model explicitly defined" },
];

export function getBatchedMigratableCollections(batchSize: number = 10): InventoryItem[][] {
  const migratable = MIGRATION_INVENTORY.filter(item => item.classification === "MIGRATE")
    .sort((a, b) => a.collection.localeCompare(b.collection)); // Deterministic ordering

  const batches: InventoryItem[][] = [];
  for (let i = 0; i < migratable.length; i += batchSize) {
    batches.push(migratable.slice(i, i + batchSize));
  }
  return batches;
}
